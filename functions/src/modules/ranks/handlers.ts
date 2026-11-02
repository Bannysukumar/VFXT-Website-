import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import {
  DEFAULT_RANK_MAX_CYCLES,
  qualifiedRank,
  RANK_REWARDS,
  rankThresholdCents,
} from '../../config/plan';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  buildIdempotencyKey,
  claimIdempotencyKey,
} from '../../lib/idempotency';
import { requireAuth } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { RankPayout, UserProfile } from '../../types/models';
import type { RankRewardConfig } from '../platform/types';
import { userHasActiveStake } from '../staking/active-stake';
import { ensureUserWallets } from '../wallets/handlers';
import { creditAvailable } from '../wallets/ledger';
import { walletDocId } from '../wallets/types';

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: () => number }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

function resolveRankRow(
  rank: number,
  planRanks: RankRewardConfig[] | undefined,
  tokensPerUsd: number,
): {
  leftMinor: number;
  rightMinor: number;
  rewardMinor: number;
  cycleDays: number;
  maxCycles: number;
  enabled: boolean;
} | null {
  const fromPlan = planRanks?.find((r) => r.rank === rank);
  if (fromPlan) {
    if (fromPlan.enabled === false) return null;
    return {
      leftMinor: fromPlan.leftUsd * tokensPerUsd,
      rightMinor: fromPlan.rightUsd * tokensPerUsd,
      rewardMinor: fromPlan.rewardUsd * tokensPerUsd,
      cycleDays: fromPlan.cycleDays,
      maxCycles:
        Number.isFinite(fromPlan.maxCycles) && fromPlan.maxCycles > 0
          ? Math.floor(fromPlan.maxCycles)
          : DEFAULT_RANK_MAX_CYCLES,
      enabled: true,
    };
  }
  const fallback = rankThresholdCents(rank, tokensPerUsd);
  if (!fallback) return null;
  return { ...fallback, enabled: true };
}

async function tryPayRank(
  userRef: FirebaseFirestore.DocumentReference,
  user: UserProfile,
  now: number,
  tokensPerUsd: number,
  planRanks: RankRewardConfig[],
): Promise<boolean> {
  const db = getDb();
  const left = user.leftVolumeMinor ?? 0;
  const right = user.rightVolumeMinor ?? 0;
  const payRank = qualifiedRank(left, right, tokensPerUsd);
  if (payRank <= 0) return false;

  const threshold = resolveRankRow(payRank, planRanks, tokensPerUsd);
  if (!threshold) return false;

  // Rank salary requires an active stake (same rule as other incomes).
  if (!(await userHasActiveStake(db, user.uid))) {
    return false;
  }

  const lastPaidMs = toMillis(user.lastRankPaidAt);
  const cycleMs = threshold.cycleDays * 24 * 60 * 60 * 1000;
  if (lastPaidMs !== null && now - lastPaidMs < cycleMs) return false;

  const salaryRank = user.rankSalaryRank ?? 0;
  const cyclesPaid = user.rankSalaryCyclesPaid ?? 0;
  // Same rank already hit max cycles → wait until they qualify for a higher rank.
  if (salaryRank === payRank && cyclesPaid >= threshold.maxCycles) {
    return false;
  }

  const rewardMinor = threshold.rewardMinor;
  const payoutId = uuidv4();
  const idemKey = buildIdempotencyKey(
    'rank_reward',
    `${user.uid}:R${payRank}:${Math.floor(now / cycleMs)}`,
    user.uid,
  );

  await ensureUserWallets(db, user.uid);
  let paid = false;
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(userRef);
    if (!fresh.exists) return;
    const u = fresh.data() as UserProfile;
    const leftNow = u.leftVolumeMinor ?? 0;
    const rightNow = u.rightVolumeMinor ?? 0;
    const qNow = qualifiedRank(leftNow, rightNow, tokensPerUsd);
    if (qNow < payRank) return;

    const lastMs = toMillis(u.lastRankPaidAt);
    if (lastMs !== null && now - lastMs < cycleMs) return;

    const paidRankNow = u.rankSalaryRank ?? 0;
    const cyclesNow = u.rankSalaryCyclesPaid ?? 0;
    if (paidRankNow === payRank && cyclesNow >= threshold.maxCycles) return;

    const nextCycles = paidRankNow === payRank ? cyclesNow + 1 : 1;

    await claimIdempotencyKey(
      tx,
      db,
      idemKey,
      'rank_reward',
      'system',
      payoutId,
    );

    await creditAvailable(tx, db, {
      userId: u.uid,
      walletId: walletDocId(u.uid, 'level_income'),
      type: 'rank_reward',
      amountMinor: rewardMinor,
      currency: 'VFXT',
      referenceType: 'rank_payout',
      referenceId: payoutId,
      description: `Rank ${payRank} reward (cycle ${nextCycles}/${threshold.maxCycles})`,
      createdBy: 'system',
      metadata: {
        rank: payRank,
        cycle: nextCycles,
        maxCycles: threshold.maxCycles,
        leftVolumeMinor: leftNow,
        rightVolumeMinor: rightNow,
      },
    });

    const payout: RankPayout = {
      payoutId,
      userId: u.uid,
      rank: payRank,
      rewardMinor,
      leftVolumeMinor: leftNow,
      rightVolumeMinor: rightNow,
      createdAt: FieldValue.serverTimestamp(),
    };
    tx.set(db.collection(Collections.rankPayouts).doc(payoutId), payout);

    tx.update(userRef, {
      currentRank: Math.max(u.currentRank ?? 0, payRank),
      lastRankPaidAt: FieldValue.serverTimestamp(),
      rankCycleStart: u.rankCycleStart ?? FieldValue.serverTimestamp(),
      rankSalaryRank: payRank,
      rankSalaryCyclesPaid: nextCycles,
      updatedAt: FieldValue.serverTimestamp(),
    });
    paid = true;
  });

  return paid;
}

export const getRankStatus = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const db = getDb();
    const { getTokenEconomicsSettings, getPlanSettings } = await import(
      '../platform/store'
    );
    const tokenFx = await getTokenEconomicsSettings();
    const plan = await getPlanSettings();
    const rate = tokenFx.tokensPerUsd;
    const snap = await db.collection(Collections.users).doc(ctx.uid).get();
    if (!snap.exists) {
      throw new AppError('not-found', 'User profile not found');
    }
    const user = snap.data() as UserProfile;
    const left = user.leftVolumeMinor ?? 0;
    const right = user.rightVolumeMinor ?? 0;
    const current = user.currentRank ?? 0;
    const q = qualifiedRank(left, right, rate);
    const nextRank = current < 9 ? current + 1 : null;
    const next = nextRank
      ? resolveRankRow(nextRank, plan.rankRewards, rate)
      : null;

    const salaryRank = user.rankSalaryRank ?? current;
    const salaryRow = salaryRank
      ? resolveRankRow(salaryRank, plan.rankRewards, rate)
      : null;
    const cyclesPaid = user.rankSalaryCyclesPaid ?? 0;
    const maxCycles = salaryRow?.maxCycles ?? DEFAULT_RANK_MAX_CYCLES;

    const ranks = (plan.rankRewards?.length ? plan.rankRewards : RANK_REWARDS).map(
      (r) => {
        const row = resolveRankRow(r.rank, plan.rankRewards, rate);
        return {
          rank: r.rank,
          leftMinor: row?.leftMinor ?? 0,
          rightMinor: row?.rightMinor ?? 0,
          rewardMinor: row?.rewardMinor ?? 0,
          cycleDays: row?.cycleDays ?? ('cycleDays' in r ? r.cycleDays : 7),
          maxCycles: row?.maxCycles ?? DEFAULT_RANK_MAX_CYCLES,
          enabled: row?.enabled !== false,
        };
      },
    );

    return {
      currentRank: current,
      qualifiedRank: q,
      leftVolumeMinor: left,
      rightVolumeMinor: right,
      currency: 'VFXT' as const,
      nextRank,
      nextLeftNeedMinor: next ? Math.max(0, next.leftMinor - left) : 0,
      nextRightNeedMinor: next ? Math.max(0, next.rightMinor - right) : 0,
      lastRewardAt: user.lastRankPaidAt ?? null,
      salaryRank: salaryRank || null,
      salaryCyclesPaid: cyclesPaid,
      salaryMaxCycles: maxCycles,
      salaryCyclesRemaining: Math.max(0, maxCycles - cyclesPaid),
      ranks,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/**
 * Daily: pay rank rewards to level_income when both legs qualify and cycle is due.
 * Stops after maxCycles at the current rank; resumes when a higher rank is reached.
 */
export const processRankRewards = onSchedule(
  {
    schedule: 'every 24 hours',
    region: 'us-central1',
    timeZone: 'UTC',
  },
  async () => {
    const db = getDb();
    const now = Date.now();
    const pageSize = 100;
    let paid = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const { getTokenEconomicsSettings, getPlanSettings } = await import(
      '../platform/store'
    );
    const tokenFx = await getTokenEconomicsSettings();
    const plan = await getPlanSettings();
    const rate = tokenFx.tokensPerUsd;
    // Rank 1 threshold in VFXT tokens (was $1,000 in cents before tokens-only).
    const minVolumeTokens = 1_000 * rate;

    for (let page = 0; page < 50; page += 1) {
      let query = db
        .collection(Collections.users)
        .where('leftVolumeMinor', '>=', minVolumeTokens)
        .orderBy('leftVolumeMinor')
        .orderBy('__name__')
        .limit(pageSize);

      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }

      const snap = await query.get();
      if (snap.empty) break;
      lastDoc = snap.docs[snap.docs.length - 1]!;

      for (const doc of snap.docs) {
        const user = { ...(doc.data() as UserProfile), uid: doc.id };
        try {
          const ok = await tryPayRank(
            doc.ref,
            user,
            now,
            rate,
            plan.rankRewards ?? [],
          );
          if (ok) paid += 1;
        } catch (err) {
          log.warn('rank_reward_failed', {
            uid: user.uid,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      if (snap.size < pageSize) break;
    }

    log.info('processRankRewards_done', { paid });
  },
);
