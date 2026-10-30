import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import {
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

async function tryPayRank(
  userRef: FirebaseFirestore.DocumentReference,
  user: UserProfile,
  now: number,
): Promise<boolean> {
  const db = getDb();
  const left = user.leftVolumeMinor ?? 0;
  const right = user.rightVolumeMinor ?? 0;
  const payRank = qualifiedRank(left, right);
  if (payRank <= 0) return false;

  const threshold = rankThresholdCents(payRank);
  if (!threshold) return false;

  const lastPaidMs = toMillis(user.lastRankPaidAt);
  const cycleMs = threshold.cycleDays * 24 * 60 * 60 * 1000;
  if (lastPaidMs !== null && now - lastPaidMs < cycleMs) return false;

  const rewardMinor = threshold.rewardMinor;
  const payoutId = uuidv4();
  const idemKey = buildIdempotencyKey(
    'rank_reward',
    `${user.uid}:R${payRank}:${Math.floor(now / cycleMs)}`,
    user.uid,
  );

  await ensureUserWallets(db, user.uid);
  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(userRef);
    if (!fresh.exists) return;
    const u = fresh.data() as UserProfile;
    const leftNow = u.leftVolumeMinor ?? 0;
    const rightNow = u.rightVolumeMinor ?? 0;
    const qNow = qualifiedRank(leftNow, rightNow);
    if (qNow < payRank) return;

    const lastMs = toMillis(u.lastRankPaidAt);
    if (lastMs !== null && now - lastMs < cycleMs) return;

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
      currency: 'USD',
      referenceType: 'rank_payout',
      referenceId: payoutId,
      description: `Rank ${payRank} reward`,
      createdBy: 'system',
      metadata: {
        rank: payRank,
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
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  return true;
}

export const getRankStatus = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const db = getDb();
    const snap = await db.collection(Collections.users).doc(ctx.uid).get();
    if (!snap.exists) {
      throw new AppError('not-found', 'User profile not found');
    }
    const user = snap.data() as UserProfile;
    const left = user.leftVolumeMinor ?? 0;
    const right = user.rightVolumeMinor ?? 0;
    const current = user.currentRank ?? 0;
    const q = qualifiedRank(left, right);
    const nextRank = current < 9 ? current + 1 : null;
    const next = nextRank ? rankThresholdCents(nextRank) : null;

    return {
      currentRank: current,
      qualifiedRank: q,
      leftVolumeMinor: left,
      rightVolumeMinor: right,
      nextRank,
      nextLeftNeedMinor: next ? Math.max(0, next.leftMinor - left) : 0,
      nextRightNeedMinor: next ? Math.max(0, next.rightMinor - right) : 0,
      lastRewardAt: user.lastRankPaidAt ?? null,
      ranks: RANK_REWARDS.map((r) => ({
        rank: r.rank,
        leftMinor: r.leftUsd * 100,
        rightMinor: r.rightUsd * 100,
        rewardMinor: r.rewardUsd * 100,
        cycleDays: r.cycleDays,
      })),
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/**
 * Daily: pay rank rewards to level_income when both legs qualify and cycle is due.
 * Batched queries with limits (pragmatic).
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

    for (let page = 0; page < 50; page += 1) {
      let query = db
        .collection(Collections.users)
        .where('leftVolumeMinor', '>=', 100_000)
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
          const ok = await tryPayRank(doc.ref, user, now);
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
