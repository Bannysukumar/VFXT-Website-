import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { UserRecord } from 'firebase-admin/auth';
import { v4 as uuidv4 } from 'uuid';
import {
  isLevelUnlocked,
  LEVEL_COMMISSION_BPS,
} from '../../config/plan';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { ReferralDoc, UserProfile, WalletDoc } from '../../types/models';
import { walletDocId } from '../wallets/types';
import { countDirectReferrals } from '../staking/commissions';
import { placeInBinaryTree } from './binary';
import { applyReferralCodeSchema, listReferralsSchema } from './schemas';

const PENDING_REFERRAL_CLAIM = 'pendingReferralCode';

export async function applyCodeForUserExport(
  refereeId: string,
  code: string,
): Promise<{ referralId: string; referrerId: string; ok: true }> {
  const db = getDb();
  const normalized = code.trim().toUpperCase();

  let referrerSnap = await db
    .collection(Collections.users)
    .where('referralCode', '==', normalized)
    .limit(1)
    .get();

  if (referrerSnap.empty && code.trim() !== normalized) {
    referrerSnap = await db
      .collection(Collections.users)
      .where('referralCode', '==', code.trim())
      .limit(1)
      .get();
  }

  if (referrerSnap.empty) {
    throw new AppError('not-found', 'Referral code not found');
  }

  const referrerDoc = referrerSnap.docs[0]!;
  const referrerId = referrerDoc.id;
  if (referrerId === refereeId) {
    throw new AppError('invalid-argument', 'Cannot use your own referral code');
  }

  const refereeRef = db.collection(Collections.users).doc(refereeId);
  const referralId = uuidv4();

  await db.runTransaction(async (tx) => {
    const refereeSnap = await tx.get(refereeRef);
    if (!refereeSnap.exists) {
      throw new AppError('not-found', 'User profile not found');
    }
    const referee = refereeSnap.data() as UserProfile;
    if (referee.referredBy) {
      throw new AppError(
        'failed-precondition',
        'Referral already applied for this account',
      );
    }

    const existing = await tx.get(
      db
        .collection(Collections.referrals)
        .where('refereeId', '==', refereeId)
        .limit(1),
    );
    if (!existing.empty) {
      throw new AppError('failed-precondition', 'Referral already recorded');
    }

    const placement = await placeInBinaryTree(
      tx,
      db,
      referrerId,
      refereeId,
    );

    const referral: ReferralDoc = {
      referralId,
      referrerId,
      refereeId,
      code: (referrerDoc.data()?.referralCode as string) ?? normalized,
      status: 'active',
      binarySide: placement.side,
      createdAt: FieldValue.serverTimestamp(),
    };

    tx.set(db.collection(Collections.referrals).doc(referralId), referral);
    tx.update(refereeRef, {
      referredBy: referrerId,
      binaryParentId: placement.parentId,
      binarySide: placement.side,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  log.info('referral_applied', {
    referralId,
    referrerId,
    refereeId,
  });
  return { referralId, referrerId, ok: true };
}

/**
 * Best-effort apply of a pending referral code from Auth custom claims
 * during signup provisioning.
 */
export async function maybeApplyPendingReferral(
  uid: string,
  user: UserRecord,
): Promise<void> {
  const claims = (user.customClaims ?? {}) as Record<string, unknown>;
  const pending =
    typeof claims[PENDING_REFERRAL_CLAIM] === 'string'
      ? (claims[PENDING_REFERRAL_CLAIM] as string)
      : null;
  if (!pending) return;
  await applyCodeForUserExport(uid, pending);
}

async function handleApplyReferralCode(
  request: CallableRequest,
): Promise<{ referralId: string; referrerId: string; ok: true }> {
  const ctx = requireAuth(request);
  const parsed = applyReferralCodeSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }
  return applyCodeForUserExport(ctx.uid, parsed.data.code);
}

export const applyReferralCode = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleApplyReferralCode(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleListReferrals(
  request: CallableRequest,
): Promise<{
  referrals: Array<Record<string, unknown>>;
  stats: { directCount: number; unlockedLevels: number };
}> {
  const ctx = requireAuth(request);
  const parsed = listReferralsSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  const snap = await db
    .collection(Collections.referrals)
    .where('referrerId', '==', ctx.uid)
    .limit(parsed.data.limit)
    .get();

  const referrals = snap.docs.map((d) => {
    const data = d.data() as ReferralDoc;
    return {
      referralId: data.referralId,
      refereeId: data.refereeId,
      code: data.code,
      status: data.status,
      binarySide: data.binarySide ?? null,
      createdAt: data.createdAt ?? null,
    };
  });

  const directCount = await countDirectReferrals(db, ctx.uid);
  let unlockedLevels = 0;
  for (let level = 1; level <= LEVEL_COMMISSION_BPS.length; level += 1) {
    if (isLevelUnlocked(directCount, level)) unlockedLevels = level;
  }

  return {
    referrals,
    stats: { directCount, unlockedLevels },
  };
}

export const listReferrals = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleListReferrals(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleGetAffiliateDashboard(
  request: CallableRequest,
): Promise<Record<string, unknown>> {
  const ctx = requireAuth(request);
  const db = getDb();

  const userSnap = await db.collection(Collections.users).doc(ctx.uid).get();
  if (!userSnap.exists) {
    throw new AppError('not-found', 'User profile not found');
  }
  const user = userSnap.data() as UserProfile;

  const directCount = await countDirectReferrals(db, ctx.uid);
  let unlockedLevels = 0;
  for (let level = 1; level <= LEVEL_COMMISSION_BPS.length; level += 1) {
    if (isLevelUnlocked(directCount, level)) unlockedLevels = level;
  }

  const refsSnap = await db
    .collection(Collections.referrals)
    .where('referrerId', '==', ctx.uid)
    .where('status', '==', 'active')
    .limit(50)
    .get();

  const directs: Array<{
    uid: string;
    email?: string | null;
    createdAt?: unknown;
  }> = [];
  for (const d of refsSnap.docs) {
    const ref = d.data() as ReferralDoc;
    const refereeSnap = await db
      .collection(Collections.users)
      .doc(ref.refereeId)
      .get();
    const email = refereeSnap.exists
      ? ((refereeSnap.data() as UserProfile).email ?? null)
      : null;
    directs.push({
      uid: ref.refereeId,
      email,
      createdAt: ref.createdAt ?? null,
    });
  }

  const levelWalletSnap = await db
    .collection(Collections.wallets)
    .doc(walletDocId(ctx.uid, 'level_income'))
    .get();
  const levelIncomeMinor = levelWalletSnap.exists
    ? (levelWalletSnap.data() as WalletDoc).availableMinor
    : 0;

  // Per-level earned (best-effort from ledger; capped query).
  const levelStats = [];
  for (let level = 1; level <= LEVEL_COMMISSION_BPS.length; level += 1) {
    levelStats.push({
      level,
      rateBps: LEVEL_COMMISSION_BPS[level - 1],
      unlocked: isLevelUnlocked(directCount, level),
      earnedMinor: 0,
    });
  }

  const ledgerSnap = await db
    .collection(Collections.ledger)
    .where('userId', '==', ctx.uid)
    .where('type', '==', 'level_commission')
    .limit(200)
    .get();
  for (const entry of ledgerSnap.docs) {
    const data = entry.data();
    const level = Number(data.metadata?.level ?? 0);
    if (level >= 1 && level <= levelStats.length) {
      levelStats[level - 1]!.earnedMinor += data.amountMinor as number;
    }
  }

  return {
    referralCode: user.referralCode,
    directCount,
    unlockedLevels,
    levelIncomeMinor,
    directs,
    levelStats,
    binary: {
      leftVolumeMinor: user.leftVolumeMinor ?? 0,
      rightVolumeMinor: user.rightVolumeMinor ?? 0,
      binaryLeftId: user.binaryLeftId ?? null,
      binaryRightId: user.binaryRightId ?? null,
      currentRank: user.currentRank ?? 0,
    },
  };
}

export const getAffiliateDashboard = onCall(
  CALLABLE_OPTS,
  async (request) => {
    try {
      return await handleGetAffiliateDashboard(request);
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);
