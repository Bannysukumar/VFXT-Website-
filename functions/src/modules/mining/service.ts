import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  formatMinor,
  fromMinorString,
  minBigInt,
  parseToMinor,
  rewardForElapsed,
  toMinorString,
} from './money';
import type {
  ClaimRequestDoc,
  MiningBalanceDoc,
  MiningConfigDoc,
  MiningSessionDoc,
  PayoutMode,
  RewardLedgerDoc,
} from './types';

const CONFIG_ID = 'default';

const DEFAULT_CONFIG: MiningConfigDoc = {
  enabled: true,
  // 10 VFXT / hour
  ratePerHourMinor: toMinorString(parseToMinor('10')),
  // 1 hour sessions (good for device testing; admin can change)
  durationSeconds: 3600,
  minimumClaimMinor: toMinorString(parseToMinor('1')),
  maximumRewardMinor: toMinorString(parseToMinor('100')),
  allowStop: true,
  payoutMode: 'admin_approved',
};

export async function ensureMiningConfig(): Promise<MiningConfigDoc> {
  const db = getDb();
  const ref = db.collection(Collections.miningConfigs).doc(CONFIG_ID);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as MiningConfigDoc;
  await ref.set({ ...DEFAULT_CONFIG, updatedAt: FieldValue.serverTimestamp() });
  return DEFAULT_CONFIG;
}

export async function getMiningConfig(): Promise<MiningConfigDoc> {
  return ensureMiningConfig();
}

export async function updateMiningConfig(
  patch: Partial<MiningConfigDoc>,
): Promise<MiningConfigDoc> {
  const db = getDb();
  const ref = db.collection(Collections.miningConfigs).doc(CONFIG_ID);
  await ensureMiningConfig();
  await ref.set({ ...patch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  const snap = await ref.get();
  return snap.data() as MiningConfigDoc;
}

async function getBalance(userId: string): Promise<MiningBalanceDoc> {
  const db = getDb();
  const ref = db.collection(Collections.miningBalances).doc(userId);
  const snap = await ref.get();
  if (snap.exists) return snap.data() as MiningBalanceDoc;
  return {
    userId,
    availableMinor: '0',
    lifetimeMinor: '0',
    claimedMinor: '0',
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/** Finalize expired/stopped sessions and credit the reward ledger atomically. */
export async function finalizeDueSessions(userId: string, now = Date.now()): Promise<void> {
  const db = getDb();
  const active = await db
    .collection(Collections.miningSessions)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();

  for (const doc of active.docs) {
    const session = doc.data() as MiningSessionDoc;
    const endMs = session.endTime.toMillis();
    if (now < endMs) continue;
    await completeSession(doc.id, session, 'completed', endMs);
  }
}

async function completeSession(
  sessionId: string,
  session: MiningSessionDoc,
  status: 'completed' | 'stopped',
  endMs: number,
): Promise<bigint> {
  const db = getDb();
  const config = await getMiningConfig();
  const startMs = session.startTime.toMillis();
  const elapsedSec = BigInt(Math.max(0, Math.floor((endMs - startMs) / 1000)));
  const rate = fromMinorString(session.rateSnapshotMinor);
  let reward = rewardForElapsed(rate, elapsedSec);
  const cap = fromMinorString(config.maximumRewardMinor);
  reward = minBigInt(reward, cap);

  await db.runTransaction(async (tx) => {
    const sessionRef = db.collection(Collections.miningSessions).doc(sessionId);
    const fresh = await tx.get(sessionRef);
    if (!fresh.exists) return;
    const current = fresh.data() as MiningSessionDoc;
    if (current.status !== 'active') return;

    const balanceRef = db.collection(Collections.miningBalances).doc(session.userId);
    const balanceSnap = await tx.get(balanceRef);
    const balance = balanceSnap.exists
      ? (balanceSnap.data() as MiningBalanceDoc)
      : {
          userId: session.userId,
          availableMinor: '0',
          lifetimeMinor: '0',
          claimedMinor: '0',
          updatedAt: FieldValue.serverTimestamp(),
        };

    const available = fromMinorString(balance.availableMinor) + reward;
    const lifetime = fromMinorString(balance.lifetimeMinor) + reward;
    const ledgerId = randomUUID();
    const ledgerRef = db.collection(Collections.rewardLedger).doc(ledgerId);
    const ledger: RewardLedgerDoc = {
      ledgerId,
      userId: session.userId,
      amountMinor: toMinorString(reward),
      type: 'mining_credit',
      sessionId,
      claimId: null,
      createdAt: FieldValue.serverTimestamp(),
    };

    tx.update(sessionRef, {
      status,
      rewardAmountMinor: toMinorString(reward),
      completedAt: Timestamp.fromMillis(endMs),
      endTime: status === 'stopped' ? Timestamp.fromMillis(endMs) : current.endTime,
    });
    tx.set(
      balanceRef,
      {
        userId: session.userId,
        availableMinor: toMinorString(available),
        lifetimeMinor: toMinorString(lifetime),
        claimedMinor: balance.claimedMinor ?? '0',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    tx.set(ledgerRef, ledger);
  });

  return reward;
}

export async function startMiningSession(userId: string, walletAddress: string) {
  const db = getDb();
  await finalizeDueSessions(userId);
  const config = await getMiningConfig();
  if (!config.enabled) {
    throw new AppError('failed-precondition', 'Mining is currently disabled');
  }

  const active = await db
    .collection(Collections.miningSessions)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (!active.empty) {
    throw new AppError('already-exists', 'You already have an active mining session');
  }

  // Effective rate = free mining rate + active paid boosters (server-authoritative).
  const { getEffectiveMiningRateMinor } = await import('./boosters');
  const rates = await getEffectiveMiningRateMinor(userId);

  const now = Date.now();
  const sessionId = randomUUID();
  const session: MiningSessionDoc = {
    sessionId,
    userId,
    walletAddress: walletAddress.toLowerCase(),
    startTime: Timestamp.fromMillis(now),
    endTime: Timestamp.fromMillis(now + config.durationSeconds * 1000),
    rateSnapshotMinor: toMinorString(rates.effectiveRateMinor),
    status: 'active',
    rewardAmountMinor: '0',
    completedAt: null,
  };
  await db.collection(Collections.miningSessions).doc(sessionId).set(session);
  return session;
}

export async function stopMiningSession(userId: string) {
  const db = getDb();
  const config = await getMiningConfig();
  if (!config.allowStop) {
    throw new AppError('failed-precondition', 'Stopping sessions is not allowed');
  }
  const active = await db
    .collection(Collections.miningSessions)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (active.empty) {
    throw new AppError('failed-precondition', 'No active mining session');
  }
  const doc = active.docs[0]!;
  const session = doc.data() as MiningSessionDoc;
  const reward = await completeSession(doc.id, session, 'stopped', Date.now());
  return { sessionId: doc.id, rewardMinor: toMinorString(reward) };
}

export async function getMiningStatus(userId: string) {
  await finalizeDueSessions(userId);
  const config = await getMiningConfig();
  const balance = await getBalance(userId);
  const db = getDb();
  const activeSnap = await db
    .collection(Collections.miningSessions)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();

  const active = activeSnap.empty ? null : (activeSnap.docs[0]!.data() as MiningSessionDoc);
  const { getEffectiveMiningRateMinor } = await import('./boosters');
  const rates = await getEffectiveMiningRateMinor(userId);

  return {
    config: {
      enabled: config.enabled,
      /** Free mining speed (without boosters). */
      ratePerHour: formatMinor(fromMinorString(config.ratePerHourMinor)),
      /** Free + active boosters. */
      effectiveRatePerHour: formatMinor(rates.effectiveRateMinor),
      boostBonusPerHour: formatMinor(rates.boostBonusMinor),
      durationSeconds: config.durationSeconds,
      minimumClaim: formatMinor(fromMinorString(config.minimumClaimMinor)),
      maximumReward: formatMinor(fromMinorString(config.maximumRewardMinor)),
      allowStop: config.allowStop,
      payoutMode: config.payoutMode as PayoutMode,
      boosterPaymentWallet: config.boosterPaymentWallet ?? null,
    },
    boosters: rates.activeBoosters,
    rewards: {
      available: formatMinor(fromMinorString(balance.availableMinor)),
      lifetime: formatMinor(fromMinorString(balance.lifetimeMinor)),
      claimed: formatMinor(fromMinorString(balance.claimedMinor)),
    },
    session: active
      ? {
          sessionId: active.sessionId,
          startTimeMillis: active.startTime.toMillis(),
          endTimeMillis: active.endTime.toMillis(),
          rateSnapshotPerHour: formatMinor(fromMinorString(active.rateSnapshotMinor)),
        }
      : null,
  };
}

export async function getMiningHistory(userId: string, limit = 50) {
  await finalizeDueSessions(userId);
  const db = getDb();
  const snap = await db
    .collection(Collections.miningSessions)
    .where('userId', '==', userId)
    .orderBy('startTime', 'desc')
    .limit(Math.min(limit, 100))
    .get();

  return snap.docs.map((d) => {
    const s = d.data() as MiningSessionDoc;
    return {
      sessionId: s.sessionId,
      startTimeMillis: s.startTime.toMillis(),
      endTimeMillis: (s.completedAt ?? s.endTime).toMillis(),
      reward: formatMinor(fromMinorString(s.rewardAmountMinor)),
      claimed: false,
      status: s.status,
    };
  });
}

export async function claimRewards(
  userId: string,
  destinationAddress: string,
  idempotencyKey?: string,
) {
  const db = getDb();
  await finalizeDueSessions(userId);
  const config = await getMiningConfig();
  const address = destinationAddress.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(address)) {
    throw new AppError('invalid-argument', 'Invalid destination wallet address');
  }

  if (idempotencyKey) {
    const existing = await db
      .collection(Collections.claimRequests)
      .where('userId', '==', userId)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();
    if (!existing.empty) {
      const c = existing.docs[0]!.data() as ClaimRequestDoc & { idempotencyKey?: string };
      return {
        claimId: c.claimId,
        amount: formatMinor(fromMinorString(c.amountMinor)),
        status: c.status,
        payoutMode: config.payoutMode,
      };
    }
  }

  const claimId = randomUUID();
  let claimedAmount = 0n;

  await db.runTransaction(async (tx) => {
    const balanceRef = db.collection(Collections.miningBalances).doc(userId);
    const balanceSnap = await tx.get(balanceRef);
    if (!balanceSnap.exists) {
      throw new AppError('failed-precondition', 'No mining rewards available');
    }
    const balance = balanceSnap.data() as MiningBalanceDoc;
    const available = fromMinorString(balance.availableMinor);
    const minimum = fromMinorString(config.minimumClaimMinor);
    if (available < minimum) {
      throw new AppError(
        'failed-precondition',
        `Minimum claim is ${formatMinor(minimum)} VFXT`,
      );
    }
    claimedAmount = available;
    const claimRef = db.collection(Collections.claimRequests).doc(claimId);
    const ledgerId = randomUUID();
    const ledgerRef = db.collection(Collections.rewardLedger).doc(ledgerId);

    const claim: ClaimRequestDoc & { idempotencyKey?: string } = {
      claimId,
      userId,
      amountMinor: toMinorString(claimedAmount),
      destinationAddress: address,
      network: 'bsc',
      status: config.payoutMode === 'automatic' ? 'approved' : 'pending',
      transactionHash: null,
      rejectReason: null,
      createdAt: FieldValue.serverTimestamp(),
      processedAt: null,
      ...(idempotencyKey ? { idempotencyKey } : {}),
    };

    tx.set(claimRef, claim);
    tx.set(ledgerRef, {
      ledgerId,
      userId,
      amountMinor: toMinorString(claimedAmount),
      type: 'claim_debit',
      sessionId: null,
      claimId,
      createdAt: FieldValue.serverTimestamp(),
    } satisfies RewardLedgerDoc);
    tx.set(
      balanceRef,
      {
        availableMinor: '0',
        claimedMinor: toMinorString(fromMinorString(balance.claimedMinor) + claimedAmount),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return {
    claimId,
    amount: formatMinor(claimedAmount),
    status: config.payoutMode === 'automatic' ? 'approved' : 'pending',
    payoutMode: config.payoutMode,
  };
}

export async function listClaims(userId: string, limit = 50) {
  const db = getDb();
  const snap = await db
    .collection(Collections.claimRequests)
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(Math.min(limit, 100))
    .get();
  return snap.docs.map((d) => {
    const c = d.data() as ClaimRequestDoc;
    return {
      claimId: c.claimId,
      amount: formatMinor(fromMinorString(c.amountMinor)),
      status: c.status,
      destinationAddress: c.destinationAddress,
      network: c.network,
      transactionHash: c.transactionHash ?? null,
      createdAtMillis: (c.createdAt as FirebaseFirestore.Timestamp).toMillis?.() ?? Date.now(),
    };
  });
}

export async function adminSetClaimStatus(
  claimId: string,
  status: 'approved' | 'rejected' | 'paid' | 'failed',
  opts?: { reason?: string; transactionHash?: string },
) {
  const db = getDb();
  const ref = db.collection(Collections.claimRequests).doc(claimId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('not-found', 'Claim not found');
  const updates: Record<string, unknown> = {
    status,
    processedAt: FieldValue.serverTimestamp(),
  };
  if (opts?.reason) updates.rejectReason = opts.reason;
  if (opts?.transactionHash) updates.transactionHash = opts.transactionHash;
  await ref.update(updates);
  return { claimId, status };
}

export async function adminListClaims(statusFilter?: string, limit = 50) {
  const db = getDb();
  let q: FirebaseFirestore.Query = db.collection(Collections.claimRequests);
  if (statusFilter) {
    q = q.where('status', '==', statusFilter);
  }
  q = q.orderBy('createdAt', 'desc').limit(Math.min(limit, 100));
  const snap = await q.get();
  return snap.docs.map((d) => {
    const c = d.data() as ClaimRequestDoc;
    return {
      claimId: c.claimId,
      userId: c.userId,
      amount: formatMinor(fromMinorString(c.amountMinor)),
      destinationAddress: c.destinationAddress,
      network: c.network,
      status: c.status,
      transactionHash: c.transactionHash ?? null,
      rejectReason: c.rejectReason ?? null,
      createdAtMillis: (c.createdAt as FirebaseFirestore.Timestamp).toMillis?.() ?? null,
    };
  });
}

export async function adminMiningDashboard() {
  const db = getDb();
  const config = await getMiningConfig();
  const [sessionsSnap, claimsPendingSnap, claimsPaidSnap, balancesSnap] = await Promise.all([
    db.collection(Collections.miningSessions).where('status', '==', 'active').get(),
    db.collection(Collections.claimRequests).where('status', '==', 'pending').get(),
    db.collection(Collections.claimRequests).where('status', '==', 'paid').limit(200).get(),
    db.collection(Collections.miningBalances).get(),
  ]);

  let totalLifetimeMinor = 0n;
  let totalAvailableMinor = 0n;
  let totalClaimedMinor = 0n;
  for (const doc of balancesSnap.docs) {
    const b = doc.data() as MiningBalanceDoc;
    totalLifetimeMinor += fromMinorString(b.lifetimeMinor);
    totalAvailableMinor += fromMinorString(b.availableMinor);
    totalClaimedMinor += fromMinorString(b.claimedMinor);
  }

  let paidTotalMinor = 0n;
  for (const doc of claimsPaidSnap.docs) {
    const c = doc.data() as ClaimRequestDoc;
    paidTotalMinor += fromMinorString(c.amountMinor);
  }

  const { adminBoosterStats } = await import('./boosters');
  const boosterStats = await adminBoosterStats();

  return {
    config: {
      enabled: config.enabled,
      ratePerHour: formatMinor(fromMinorString(config.ratePerHourMinor)),
      durationSeconds: config.durationSeconds,
      minimumClaim: formatMinor(fromMinorString(config.minimumClaimMinor)),
      maximumReward: formatMinor(fromMinorString(config.maximumRewardMinor)),
      allowStop: config.allowStop,
      payoutMode: config.payoutMode,
      boosterPaymentWallet: config.boosterPaymentWallet ?? null,
    },
    stats: {
      activeSessions: sessionsSnap.size,
      pendingClaims: claimsPendingSnap.size,
      miningUsers: balancesSnap.size,
      totalLifetime: formatMinor(totalLifetimeMinor),
      totalAvailable: formatMinor(totalAvailableMinor),
      totalClaimed: formatMinor(totalClaimedMinor),
      totalPaidOut: formatMinor(paidTotalMinor),
      activeBoosters: boosterStats.activeBoosters,
      activatedBoosterPurchases: boosterStats.activatedPurchases,
      boosterRevenueUsdt: boosterStats.totalRevenueUsdt,
    },
  };
}
