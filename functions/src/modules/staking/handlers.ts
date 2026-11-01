import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  DAILY_YIELD,
  getLockedPackage,
  isDailyYieldDue,
  LOCKED_PACKAGES,
  lockedMaturityPayout,
  MIN_STAKE_USD_CENTS,
  nextDailyYieldCents,
  nextDailyYieldDueAtMs,
  payoutCapCents,
  shouldStopDailyYield,
  StakingPlanId,
} from '../../config/plan';
import { FeatureFlags } from '../../config/features';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError, FeatureDisabledError } from '../../lib/errors';
import {
  buildIdempotencyKey,
  claimIdempotencyKey,
} from '../../lib/idempotency';
import { assertPositiveMinor } from '../../lib/money';
import { requireAuth } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { StakingPosition } from '../../types/models';
import { ensureUserWallets } from '../wallets/handlers';
import { creditAvailable, debitAvailable } from '../wallets/ledger';
import { walletDocId } from '../wallets/types';
import {
  applyBinaryVolume,
  isWorkingAccount,
  payDirectReferralBonus,
  payLevelCommissions,
} from './commissions';

const createSchema = z
  .object({
    planId: z.enum([
      'daily_yield',
      'locked_300',
      'locked_500',
      'locked_700',
    ]),
    amountMinor: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();

function requireStakingEnabled(): void {
  if (!FeatureFlags.staking) {
    throw new FeatureDisabledError('staking', 'Staking is disabled');
  }
}

/** Firestore Timestamp / Date / millis → epoch ms (0 if unknown). */
function toMillis(value: unknown): number {
  if (!value) return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return 0;
}

/** Max catch-up ROI days credited per position per scheduler tick. */
const MAX_YIELD_CATCH_UP_DAYS = 7;

export const getStakingPlans = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAuth(request);
    requireStakingEnabled();

    const { getPlanSettings } = await import('../platform/store');
    const plan = await getPlanSettings();
    const minStake = plan.minStakeUsdCents || MIN_STAKE_USD_CENTS;

    const plans = [
      {
        planId: 'daily_yield' as const,
        name: 'Daily Yield',
        kind: 'daily_yield',
        dailyRateBps: plan.dailyRateBps || DAILY_YIELD.dailyRateBps,
        maxDays: plan.maxDays || DAILY_YIELD.maxDays,
        nonWorkingCapX: plan.nonWorkingCapX || DAILY_YIELD.nonWorkingCapX,
        workingCapX: plan.workingCapX || DAILY_YIELD.workingCapX,
        minStakeMinor: minStake,
        currency: 'USD' as const,
      },
      ...(plan.lockedPackages?.length
        ? plan.lockedPackages.filter((p) => p.enabled)
        : [...LOCKED_PACKAGES].map((p) => ({ ...p, enabled: true }))
      ).map((p) => ({
        planId: p.id,
        name: p.label,
        kind: 'locked' as const,
        days: p.days,
        multiplier: p.multiplier,
        bonusTokenPct: p.bonusTokenPct,
        minStakeMinor: minStake,
        currency: 'USD' as const,
      })),
    ];

    return { plans, referral: {
      levelCommissionBps: plan.levelCommissionBps,
      directReferralBonusBps: plan.directReferralBonusBps,
    }, ranks: plan.rankRewards.filter((r) => r.enabled) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Backward-compatible alias. */
export const getStakingConfigs = getStakingPlans;

async function handleCreateStakingPosition(
  request: CallableRequest,
): Promise<{ positionId: string }> {
  const ctx = requireAuth(request);
  requireStakingEnabled();

  const parsed = createSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { planId, amountMinor, idempotencyKey } = parsed.data;
  assertPositiveMinor(amountMinor);
  if (amountMinor < MIN_STAKE_USD_CENTS) {
    throw new AppError(
      'invalid-argument',
      `Minimum stake is ${MIN_STAKE_USD_CENTS} cents ($100)`,
    );
  }

  const db = getDb();
  await ensureUserWallets(db, ctx.uid);

  const working = await isWorkingAccount(db, ctx.uid);
  const positionId = uuidv4();
  const now = Timestamp.now();

  let lockedPackageId: StakingPosition['lockedPackageId'] = null;
  let multiplier: number | null = null;
  let bonusTokenPct: number | null = null;
  let lockDays: number | null = null;
  let maturesAt: Timestamp | null = null;
  let capMinor = 0;

  if (planId === 'daily_yield') {
    capMinor = payoutCapCents(amountMinor, working);
  } else {
    const pkg = getLockedPackage(planId);
    if (!pkg) {
      throw new AppError('invalid-argument', 'Unknown locked package');
    }
    lockedPackageId = pkg.id;
    multiplier = pkg.multiplier;
    bonusTokenPct = pkg.bonusTokenPct;
    lockDays = pkg.days;
    maturesAt = Timestamp.fromMillis(
      now.toMillis() + pkg.days * 24 * 60 * 60 * 1000,
    );
  }

  const key =
    idempotencyKey ||
    buildIdempotencyKey('stake.create', `${planId}:${amountMinor}`, ctx.uid);

  await db.runTransaction(async (tx) => {
    await claimIdempotencyKey(
      tx,
      db,
      key,
      'stake.create',
      ctx.uid,
      positionId,
    );

    // Debit fund + credit staking in one batch (all wallet reads before writes).
    const { applyLedgerEntries } = await import('../wallets/ledger');
    await applyLedgerEntries(tx, db, [
      {
        userId: ctx.uid,
        walletId: walletDocId(ctx.uid, 'fund'),
        type: 'stake',
        direction: 'debit',
        amountMinor,
        availableDelta: -amountMinor,
        reservedDelta: 0,
        currency: 'USD',
        referenceType: 'staking_position',
        referenceId: positionId,
        description: `Stake ${planId}`,
        createdBy: ctx.uid,
        metadata: { planId },
      },
      {
        userId: ctx.uid,
        walletId: walletDocId(ctx.uid, 'staking'),
        type: 'stake',
        direction: 'credit',
        amountMinor,
        availableDelta: amountMinor,
        reservedDelta: 0,
        currency: 'USD',
        referenceType: 'staking_position',
        referenceId: positionId,
        description: `Staking principal locked (${planId})`,
        createdBy: ctx.uid,
        metadata: { planId },
      },
    ]);

    const position: StakingPosition = {
      positionId,
      userId: ctx.uid,
      planId: planId as StakingPlanId,
      lockedPackageId,
      principalMinor: amountMinor,
      totalPaidMinor: 0,
      daysPaid: 0,
      status: 'active',
      workingAccount: working,
      capMinor,
      multiplier,
      bonusTokenPct,
      lockDays,
      maturesAt,
      completedAt: null,
      lastYieldAt: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(
      db.collection(Collections.stakingPositions).doc(positionId),
      position,
    );
  });

  // Commissions + binary volume after stake commits (own txs / increments).
  try {
    await payLevelCommissions(db, {
      stakerId: ctx.uid,
      stakeCents: amountMinor,
      positionId,
      createdBy: ctx.uid,
    });
    await payDirectReferralBonus(db, {
      stakerId: ctx.uid,
      stakeCents: amountMinor,
      positionId,
      createdBy: ctx.uid,
    });
    await applyBinaryVolume(db, ctx.uid, amountMinor);
  } catch (err) {
    log.warn('post_stake_side_effects_failed', {
      positionId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log.info('staking_position_created', {
    positionId,
    uid: ctx.uid,
    planId,
    amountMinor,
  });
  return { positionId };
}

export const createStakingPosition = onCall(
  CALLABLE_OPTS,
  async (request) => {
    try {
      return await handleCreateStakingPosition(request);
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);

async function handleGetMyPositions(
  request: CallableRequest,
): Promise<{ positions: Array<Record<string, unknown>> }> {
  const ctx = requireAuth(request);
  requireStakingEnabled();
  const db = getDb();

  const snap = await db
    .collection(Collections.stakingPositions)
    .where('userId', '==', ctx.uid)
    .limit(100)
    .get();

  const toIso = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate().toISOString();
    }
    return null;
  };

  const positions = snap.docs.map((d) => {
    const p = d.data() as StakingPosition;
    return {
      id: p.positionId,
      positionId: p.positionId,
      planId: p.planId,
      principalMinor: p.principalMinor,
      totalPaidMinor: p.totalPaidMinor,
      daysPaid: p.daysPaid,
      status: p.status,
      workingAccount: p.workingAccount,
      capMinor: p.capMinor,
      multiplier: p.multiplier,
      bonusTokenPct: p.bonusTokenPct,
      lockDays: p.lockDays,
      createdAt: toIso(p.createdAt),
      lastYieldAt: toIso(p.lastYieldAt),
      maturesAt: toIso(p.maturesAt),
      completedAt: toIso(p.completedAt),
      nextYieldAt:
        p.planId === 'daily_yield' && p.status === 'active'
          ? new Date(
              nextDailyYieldDueAtMs(toMillis(p.createdAt), p.daysPaid),
            ).toISOString()
          : null,
    };
  });

  return { positions };
}

export const getMyPositions = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleGetMyPositions(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Frontend alias. */
export const getMyStakingPositions = getMyPositions;

/**
 * Credits 1% ROI to daily_roi for active daily_yield positions.
 *
 * Timing is per stake (not a global clock): if a user stakes at 10:00 IST,
 * day-1 ROI credits at 10:00 IST the next day, then every +24h after that.
 * Scheduler ticks every 15 minutes in Asia/Kolkata so credits land near that
 * anniversary. Stop when days>=200 OR totalPaid >= cap (2X/3X).
 */
export const processDailyYields = onSchedule(
  {
    schedule: 'every 15 minutes',
    region: 'us-central1',
    timeZone: 'Asia/Kolkata',
  },
  async () => {
    if (!FeatureFlags.staking) {
      log.info('processDailyYields_skipped_disabled');
      return;
    }

    const db = getDb();
    const pageSize = 100;
    let processed = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const nowMs = Date.now();

    for (let page = 0; page < 50; page += 1) {
      let query = db
        .collection(Collections.stakingPositions)
        .where('status', '==', 'active')
        .where('planId', '==', 'daily_yield')
        .orderBy('__name__')
        .limit(pageSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snap = await query.get();
      if (snap.empty) break;
      lastDoc = snap.docs[snap.docs.length - 1]!;

      for (const doc of snap.docs) {
        const position = doc.data() as StakingPosition;
        try {
          const createdAtMs = toMillis(position.createdAt);
          if (
            !isDailyYieldDue({
              createdAtMs,
              daysPaid: position.daysPaid,
              nowMs,
            }) &&
            !shouldStopDailyYield({
              daysPaid: position.daysPaid,
              totalPaidMinor: position.totalPaidMinor,
              capMinor: position.capMinor,
            })
          ) {
            continue;
          }

          const working = await isWorkingAccount(db, position.userId);
          const capMinor = payoutCapCents(position.principalMinor, working);

          if (
            shouldStopDailyYield({
              daysPaid: position.daysPaid,
              totalPaidMinor: position.totalPaidMinor,
              capMinor,
            })
          ) {
            await doc.ref.update({
              status: 'completed',
              workingAccount: working,
              capMinor,
              completedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
            continue;
          }

          await ensureUserWallets(db, position.userId);

          for (let catchUp = 0; catchUp < MAX_YIELD_CATCH_UP_DAYS; catchUp += 1) {
            let credited = false;

            await db.runTransaction(async (tx) => {
              const fresh = await tx.get(doc.ref);
              if (!fresh.exists) return;
              const p = fresh.data() as StakingPosition;
              if (p.status !== 'active' || p.planId !== 'daily_yield') return;

              const stakeMs = toMillis(p.createdAt);
              if (
                !isDailyYieldDue({
                  createdAtMs: stakeMs,
                  daysPaid: p.daysPaid,
                  nowMs,
                })
              ) {
                return;
              }

              const yieldCents = nextDailyYieldCents({
                principalCents: p.principalMinor,
                daysPaid: p.daysPaid,
                totalPaidMinor: p.totalPaidMinor,
                capMinor,
              });
              if (yieldCents <= 0) {
                tx.update(doc.ref, {
                  status: 'completed',
                  workingAccount: working,
                  capMinor,
                  completedAt: FieldValue.serverTimestamp(),
                  updatedAt: FieldValue.serverTimestamp(),
                });
                return;
              }

              const dayNumber = p.daysPaid + 1;
              const idemKey = buildIdempotencyKey(
                'roi.daily',
                `${p.positionId}:D${dayNumber}`,
                p.userId,
              );

              await claimIdempotencyKey(
                tx,
                db,
                idemKey,
                'roi.daily',
                'system',
                p.positionId,
              );

              await creditAvailable(tx, db, {
                userId: p.userId,
                walletId: walletDocId(p.userId, 'daily_roi'),
                type: 'roi',
                amountMinor: yieldCents,
                currency: 'USD',
                referenceType: 'staking_position',
                referenceId: p.positionId,
                description: `Daily ROI day ${dayNumber}`,
                createdBy: 'system',
                metadata: {
                  dayNumber,
                  working,
                  dueAt: new Date(
                    nextDailyYieldDueAtMs(stakeMs, p.daysPaid),
                  ).toISOString(),
                },
              });

              const nextPaid = p.totalPaidMinor + yieldCents;
              const nextDays = p.daysPaid + 1;
              const done = shouldStopDailyYield({
                daysPaid: nextDays,
                totalPaidMinor: nextPaid,
                capMinor,
              });

              tx.update(doc.ref, {
                totalPaidMinor: nextPaid,
                daysPaid: nextDays,
                workingAccount: working,
                capMinor,
                lastYieldAt: FieldValue.serverTimestamp(),
                status: done ? 'completed' : 'active',
                completedAt: done ? FieldValue.serverTimestamp() : null,
                updatedAt: FieldValue.serverTimestamp(),
              });
              credited = true;
            });

            if (!credited) break;
            processed += 1;
          }
        } catch (err) {
          log.warn('daily_yield_position_failed', {
            positionId: position.positionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (snap.size < pageSize) break;
    }

    log.info('processDailyYields_done', { processed });
  },
);

/**
 * Daily job: mature locked packages.
 *
 * Credits:
 * - principal * multiplier → withdrawal wallet (USD)
 * - principal_vfxt * bonusPct/100 → vfxt wallet (VFXT tokens)
 * Debits staking wallet tracking balance by principal.
 */
export const processLockedMaturities = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'us-central1',
    timeZone: 'UTC',
  },
  async () => {
    if (!FeatureFlags.staking) {
      log.info('processLockedMaturities_skipped_disabled');
      return;
    }

    const db = getDb();
    const now = Timestamp.now();
    const pageSize = 100;
    let processed = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    for (let page = 0; page < 50; page += 1) {
      let query = db
        .collection(Collections.stakingPositions)
        .where('status', '==', 'active')
        .where('planId', 'in', [
          'locked_300',
          'locked_500',
          'locked_700',
        ])
        .orderBy('__name__')
        .limit(pageSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snap = await query.get();
      if (snap.empty) break;
      lastDoc = snap.docs[snap.docs.length - 1]!;

      for (const doc of snap.docs) {
        const position = doc.data() as StakingPosition;
        if (!position.maturesAt) continue;
        const maturesAt =
          position.maturesAt instanceof Timestamp
            ? position.maturesAt
            : null;
        if (!maturesAt || maturesAt.toMillis() > now.toMillis()) continue;

        const multiplier = position.multiplier ?? 0;
        const bonusTokenPct = position.bonusTokenPct ?? 0;
        const { usdCreditCents, bonusVfxtTokens } = lockedMaturityPayout({
          principalCents: position.principalMinor,
          multiplier,
          bonusTokenPct,
        });

        try {
          await ensureUserWallets(db, position.userId);
          const idemKey = buildIdempotencyKey(
            'locked.maturity',
            position.positionId,
            position.userId,
          );

          await db.runTransaction(async (tx) => {
            const fresh = await tx.get(doc.ref);
            if (!fresh.exists) return;
            const p = fresh.data() as StakingPosition;
            if (p.status !== 'active') return;

            await claimIdempotencyKey(
              tx,
              db,
              idemKey,
              'locked.maturity',
              'system',
              position.positionId,
            );

            // Release staking tracking.
            await debitAvailable(tx, db, {
              userId: p.userId,
              walletId: walletDocId(p.userId, 'staking'),
              type: 'locked_maturity',
              amountMinor: p.principalMinor,
              currency: 'USD',
              referenceType: 'staking_position',
              referenceId: p.positionId,
              description: 'Locked package matured — release staking track',
              createdBy: 'system',
            });

            // USD payout = principal * multiplier → withdrawal.
            await creditAvailable(tx, db, {
              userId: p.userId,
              walletId: walletDocId(p.userId, 'withdrawal'),
              type: 'locked_maturity',
              amountMinor: usdCreditCents,
              currency: 'USD',
              referenceType: 'staking_position',
              referenceId: p.positionId,
              description: `Locked maturity ${multiplier}X USD payout`,
              createdBy: 'system',
              metadata: { multiplier },
            });

            // Bonus VFXT → vfxt wallet.
            if (bonusVfxtTokens > 0) {
              await creditAvailable(tx, db, {
                userId: p.userId,
                walletId: walletDocId(p.userId, 'vfxt'),
                type: 'locked_bonus',
                amountMinor: bonusVfxtTokens,
                currency: 'VFXT',
                referenceType: 'staking_position',
                referenceId: p.positionId,
                description: `Locked maturity +${bonusTokenPct}% VFXT bonus`,
                createdBy: 'system',
                metadata: { bonusTokenPct },
              });
            }

            tx.update(doc.ref, {
              status: 'completed',
              totalPaidMinor: usdCreditCents,
              completedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            });
          });

          processed += 1;
        } catch (err) {
          log.warn('locked_maturity_failed', {
            positionId: position.positionId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (snap.size < pageSize) break;
    }

    log.info('processLockedMaturities_done', { processed });
  },
);
