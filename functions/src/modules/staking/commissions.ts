import { FieldValue, Firestore } from 'firebase-admin/firestore';
import {
  directReferralBonusTokens,
  isLevelUnlocked,
  LEVEL_COMMISSION_BPS,
  levelCommissionCents,
} from '../../config/plan';
import { FeatureFlags } from '../../config/features';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { buildIdempotencyKey, claimIdempotencyKey } from '../../lib/idempotency';
import { log } from '../../lib/logger';
import { UserProfile } from '../../types/models';
import { ensureUserWallets } from '../wallets/handlers';
import { creditAvailable } from '../wallets/ledger';
import { walletDocId } from '../wallets/types';
import { userHasActiveStake } from './active-stake';

export async function countDirectReferrals(
  db: Firestore,
  referrerId: string,
): Promise<number> {
  const snap = await db
    .collection(Collections.referrals)
    .where('referrerId', '==', referrerId)
    .where('status', '==', 'active')
    .get();
  return snap.size;
}

export async function isWorkingAccount(
  db: Firestore,
  userId: string,
): Promise<boolean> {
  return (await countDirectReferrals(db, userId)) >= 1;
}

/**
 * Walk referredBy chain; credit unlocked level commissions to level_income.
 * Idempotent per stake+level. Runs in its own transactions (post-stake).
 */
export async function payLevelCommissions(
  db: Firestore,
  params: {
    stakerId: string;
    stakeCents: number;
    positionId: string;
    createdBy: string;
  },
): Promise<void> {
  if (!FeatureFlags.referralBonuses) return;

  const { getPlanSettings } = await import('../platform/store');
  const plan = await getPlanSettings();
  const ratesBps =
    Array.isArray(plan.levelCommissionBps) && plan.levelCommissionBps.length > 0
      ? plan.levelCommissionBps
      : [...LEVEL_COMMISSION_BPS];

  const stakerSnap = await db
    .collection(Collections.users)
    .doc(params.stakerId)
    .get();
  if (!stakerSnap.exists) return;
  let uplineId: string | null = (stakerSnap.data() as UserProfile).referredBy;

  for (let level = 1; level <= ratesBps.length; level += 1) {
    if (!uplineId) break;

    const uplineSnap = await db
      .collection(Collections.users)
      .doc(uplineId)
      .get();
    if (!uplineSnap.exists) break;
    const upline = uplineSnap.data() as UserProfile;
    const nextUpline = upline.referredBy;
    const payeeId = uplineId;

    const directs = await countDirectReferrals(db, payeeId);
    if (!isLevelUnlocked(directs, level)) {
      uplineId = nextUpline;
      continue;
    }

    // Inactive stake → this upliner earns nothing; higher upline can still earn their level.
    if (!(await userHasActiveStake(db, payeeId))) {
      log.info('level_commission_skipped_no_active_stake', {
        payeeId,
        level,
        stakerId: params.stakerId,
      });
      uplineId = nextUpline;
      continue;
    }

    const amount = levelCommissionCents(params.stakeCents, level, ratesBps);
    if (amount <= 0) {
      uplineId = nextUpline;
      continue;
    }

    await ensureUserWallets(db, payeeId);
    const idemKey = buildIdempotencyKey(
      'level_commission',
      `${params.positionId}:L${level}`,
      payeeId,
    );

    try {
      await db.runTransaction(async (tx) => {
        await claimIdempotencyKey(
          tx,
          db,
          idemKey,
          'level_commission',
          params.createdBy,
          params.positionId,
        );
        await creditAvailable(tx, db, {
          userId: payeeId,
          walletId: walletDocId(payeeId, 'level_income'),
          type: 'level_commission',
          amountMinor: amount,
          currency: 'VFXT',
          referenceType: 'staking_position',
          referenceId: params.positionId,
          description: `L${level} commission on stake`,
          createdBy: params.createdBy,
          metadata: { level, stakerId: params.stakerId },
        });
      });
    } catch (err) {
      if (err instanceof AppError && err.code === 'idempotency-conflict') {
        uplineId = nextUpline;
        continue;
      }
      log.warn('level_commission_failed', {
        payeeId,
        level,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    uplineId = nextUpline;
  }
}

/** 5% of stake as VFXT to sponsor direct_referral wallet. Once per stake. */
export async function payDirectReferralBonus(
  db: Firestore,
  params: {
    stakerId: string;
    stakeCents: number;
    positionId: string;
    createdBy: string;
  },
): Promise<void> {
  if (!FeatureFlags.referralBonuses) return;

  const stakerSnap = await db
    .collection(Collections.users)
    .doc(params.stakerId)
    .get();
  if (!stakerSnap.exists) return;
  const sponsorId = (stakerSnap.data() as UserProfile).referredBy;
  if (!sponsorId) return;

  if (!(await userHasActiveStake(db, sponsorId))) {
    log.info('direct_bonus_skipped_no_active_stake', {
      sponsorId,
      stakerId: params.stakerId,
    });
    return;
  }

  const tokens = directReferralBonusTokens(params.stakeCents);
  if (tokens <= 0) return;

  await ensureUserWallets(db, sponsorId);
  const idemKey = buildIdempotencyKey(
    'direct_bonus',
    params.positionId,
    sponsorId,
  );

  try {
    await db.runTransaction(async (tx) => {
      await claimIdempotencyKey(
        tx,
        db,
        idemKey,
        'direct_bonus',
        params.createdBy,
        params.positionId,
      );
      await creditAvailable(tx, db, {
        userId: sponsorId,
        walletId: walletDocId(sponsorId, 'direct_referral'),
        type: 'direct_bonus',
        amountMinor: tokens,
        currency: 'VFXT',
        referenceType: 'staking_position',
        referenceId: params.positionId,
        description: 'Direct referral 5% VFXT bonus',
        createdBy: params.createdBy,
        metadata: {
          stakerId: params.stakerId,
          stakeCents: params.stakeCents,
        },
      });
    });
  } catch (err) {
    if (err instanceof AppError && err.code === 'idempotency-conflict') {
      return;
    }
    log.warn('direct_bonus_failed', {
      sponsorId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Walk binary parents and add stake volume to left/right legs. */
export async function applyBinaryVolume(
  db: Firestore,
  stakerId: string,
  stakeCents: number,
): Promise<void> {
  let currentId: string | null = stakerId;
  const visited = new Set<string>();
  let guard = 0;

  while (currentId && guard < 64) {
    guard += 1;
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const snap = await db.collection(Collections.users).doc(currentId).get();
    if (!snap.exists) break;
    const user = snap.data() as UserProfile;
    const parentId = user.binaryParentId;
    const side = user.binarySide;
    if (!parentId || !side) break;

    const field = side === 'left' ? 'leftVolumeMinor' : 'rightVolumeMinor';
    await db
      .collection(Collections.users)
      .doc(parentId)
      .update({
        [field]: FieldValue.increment(stakeCents),
        updatedAt: FieldValue.serverTimestamp(),
      });

    currentId = parentId;
  }

  log.info('binary_volume_applied', { stakerId, stakeCents });
}
