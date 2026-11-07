import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
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
import {
  affiliateLevelSchema,
  applyReferralCodeSchema,
  listReferralsSchema,
} from './schemas';

const PENDING_REFERRAL_CLAIM = 'pendingReferralCode';

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return null;
}

type DownlineMember = {
  uid: string;
  displayName: string | null;
  email: string | null;
  mobile: string | null;
  referralCode: string | null;
  createdAt: string | null;
  level: number;
};

async function listDirectIds(
  db: Firestore,
  referrerId: string,
  limit = 100,
): Promise<string[]> {
  const snap = await db
    .collection(Collections.referrals)
    .where('referrerId', '==', referrerId)
    .where('status', '==', 'active')
    .limit(limit)
    .get();
  return snap.docs.map((d) => (d.data() as ReferralDoc).refereeId);
}

async function loadMemberProfiles(
  db: Firestore,
  ids: string[],
  level: number,
): Promise<DownlineMember[]> {
  const out: DownlineMember[] = [];
  for (const uid of ids) {
    const snap = await db.collection(Collections.users).doc(uid).get();
    if (!snap.exists) {
      out.push({
        uid,
        displayName: null,
        email: null,
        mobile: null,
        referralCode: null,
        createdAt: null,
        level,
      });
      continue;
    }
    const u = snap.data() as UserProfile;
    out.push({
      uid,
      displayName: u.displayName ?? null,
      email: u.email ?? null,
      mobile: u.mobile ?? null,
      referralCode: u.referralCode ?? null,
      createdAt: tsToIso(u.createdAt),
      level,
    });
  }
  return out;
}

/** BFS downline members at a specific unilevel depth (1 = directs). */
async function getMembersAtLevel(
  db: Firestore,
  rootUid: string,
  targetLevel: number,
  limit = 100,
): Promise<DownlineMember[]> {
  let current = [rootUid];
  for (let depth = 1; depth <= targetLevel; depth += 1) {
    const next: string[] = [];
    for (const uid of current) {
      const kids = await listDirectIds(db, uid, 100);
      next.push(...kids);
      if (next.length >= 500) break;
    }
    current = [...new Set(next)];
    if (depth === targetLevel) {
      return loadMemberProfiles(db, current.slice(0, limit), targetLevel);
    }
    if (current.length === 0) return [];
  }
  return [];
}

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
  const { requireActiveMember } = await import('../auth/helpers');
  await requireActiveMember(ctx.uid);
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

  const directIds = refsSnap.docs.map((d) => (d.data() as ReferralDoc).refereeId);
  const directs = await loadMemberProfiles(db, directIds, 1);

  const levelWalletSnap = await db
    .collection(Collections.wallets)
    .doc(walletDocId(ctx.uid, 'level_income'))
    .get();
  const levelIncomeMinor = levelWalletSnap.exists
    ? (levelWalletSnap.data() as WalletDoc).availableMinor
    : 0;

  // Per-level earned. Member counts for deeper levels load on the level detail page.
  const levelStats = [];
  for (let level = 1; level <= LEVEL_COMMISSION_BPS.length; level += 1) {
    levelStats.push({
      level,
      rateBps: LEVEL_COMMISSION_BPS[level - 1],
      unlocked: isLevelUnlocked(directCount, level),
      earnedMinor: 0,
      memberCount: level === 1 ? directCount : null,
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

export const getAffiliateLevelMembers = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const parsed = affiliateLevelSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.message);
    }
    const db = getDb();
    const directCount = await countDirectReferrals(db, ctx.uid);
    const unlocked = isLevelUnlocked(directCount, parsed.data.level);
    if (!unlocked) {
      return {
        level: parsed.data.level,
        unlocked: false,
        members: [] as DownlineMember[],
        count: 0,
      };
    }
    const members = await getMembersAtLevel(
      db,
      ctx.uid,
      parsed.data.level,
      parsed.data.limit,
    );
    return {
      level: parsed.data.level,
      unlocked: true,
      members,
      count: members.length,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
