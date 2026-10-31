import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';
import { getAddress } from 'ethers';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { USDT_DECIMALS } from '../../config/bsc';
import { findIncomingUsdtTransfer, verifyUsdtDepositTx } from '../crypto/bsc-usdt';
import { formatMinor, fromMinorString, parseToMinor, toMinorString } from './money';
import { ensureMiningConfig, getMiningConfig } from './service';
import type {
  MiningBoosterDoc,
  MiningBoosterPurchaseDoc,
  MiningUserBoosterDoc,
} from './types';

const PURCHASE_TTL_MS = 60 * 60 * 1000;

function assertEvmAddress(address: string): string {
  try {
    return getAddress(address.trim()).toLowerCase();
  } catch {
    throw new AppError('invalid-argument', 'Invalid BEP-20 wallet address');
  }
}

/** Parse human USDT (e.g. "5" / "5.5") into wei string (18 decimals). */
export function usdtToWeiString(amount: string): string {
  const minor = parseToMinor(amount, USDT_DECIMALS);
  if (minor <= 0n) throw new AppError('invalid-argument', 'Price must be greater than zero');
  return toMinorString(minor);
}

export function weiToUsdtDisplay(wei: string): string {
  return formatMinor(fromMinorString(wei), USDT_DECIMALS).replace(/\.?0+$/, '') || '0';
}

/** Unique exact wei: base price + (1..9999) of 10^-14 USDT to avoid collisions. */
function uniqueExpectedWei(baseWei: bigint): bigint {
  const dust = BigInt(1 + Math.floor(Math.random() * 9999)) * 10n ** 4n;
  return baseWei + dust;
}

export async function listBoosters(includeDisabled = false): Promise<MiningBoosterDoc[]> {
  const db = getDb();
  const snap = await db.collection(Collections.miningBoosters).orderBy('sortOrder', 'asc').get();
  const items = snap.docs.map((d) => d.data() as MiningBoosterDoc);
  return includeDisabled ? items : items.filter((b) => b.enabled);
}

export async function adminUpsertBooster(input: {
  boosterId?: string;
  name: string;
  description?: string;
  bonusRatePerHour: string;
  durationSeconds: number;
  priceUsdt: string;
  enabled?: boolean;
  sortOrder?: number;
}): Promise<MiningBoosterDoc> {
  const db = getDb();
  const boosterId = input.boosterId?.trim() || randomUUID();
  const priceUsdtWei = usdtToWeiString(input.priceUsdt);
  const bonusRatePerHourMinor = toMinorString(parseToMinor(input.bonusRatePerHour));
  if (input.durationSeconds < 60 || input.durationSeconds > 86400 * 30) {
    throw new AppError('invalid-argument', 'Booster duration must be between 60s and 30 days');
  }
  const ref = db.collection(Collections.miningBoosters).doc(boosterId);
  const existing = await ref.get();
  const doc: MiningBoosterDoc = {
    boosterId,
    name: input.name.trim().slice(0, 80),
    description: (input.description ?? '').trim().slice(0, 500),
    bonusRatePerHourMinor,
    durationSeconds: input.durationSeconds,
    priceUsdtWei,
    priceUsdt: weiToUsdtDisplay(priceUsdtWei),
    paymentToken: 'USDT_BEP20',
    enabled: input.enabled !== false,
    sortOrder: input.sortOrder ?? 0,
    createdAt: existing.exists
      ? (existing.data() as MiningBoosterDoc).createdAt
      : FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await ref.set(doc, { merge: true });
  return doc;
}

export async function adminDeleteBooster(boosterId: string): Promise<void> {
  const db = getDb();
  await db.collection(Collections.miningBoosters).doc(boosterId).delete();
}

export async function setBoosterPaymentWallet(address: string): Promise<string> {
  const normalized = assertEvmAddress(address);
  await ensureMiningConfig();
  await updateBoosterPaymentWallet(normalized);
  return normalized;
}

async function updateBoosterPaymentWallet(address: string) {
  const db = getDb();
  await db.collection(Collections.miningConfigs).doc('default').set(
    { boosterPaymentWallet: address, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
}

export async function getEffectiveMiningRateMinor(userId: string): Promise<{
  freeRateMinor: bigint;
  boostBonusMinor: bigint;
  effectiveRateMinor: bigint;
  activeBoosters: Array<{
    userBoosterId: string;
    boosterName: string;
    bonusRatePerHour: string;
    expiresAtMillis: number;
  }>;
}> {
  const config = await getMiningConfig();
  const freeRateMinor = fromMinorString(config.ratePerHourMinor);
  await expireUserBoosters(userId);
  const db = getDb();
  const snap = await db
    .collection(Collections.miningUserBoosters)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();

  let boostBonusMinor = 0n;
  const activeBoosters: Array<{
    userBoosterId: string;
    boosterName: string;
    bonusRatePerHour: string;
    expiresAtMillis: number;
  }> = [];

  const now = Date.now();
  for (const doc of snap.docs) {
    const b = doc.data() as MiningUserBoosterDoc;
    if (b.expiresAt.toMillis() <= now) continue;
    const bonus = fromMinorString(b.bonusRatePerHourMinor);
    boostBonusMinor += bonus;
    activeBoosters.push({
      userBoosterId: b.userBoosterId,
      boosterName: b.boosterName,
      bonusRatePerHour: formatMinor(bonus),
      expiresAtMillis: b.expiresAt.toMillis(),
    });
  }

  return {
    freeRateMinor,
    boostBonusMinor,
    effectiveRateMinor: freeRateMinor + boostBonusMinor,
    activeBoosters,
  };
}

export async function expireUserBoosters(userId: string): Promise<void> {
  const db = getDb();
  const snap = await db
    .collection(Collections.miningUserBoosters)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .get();
  const now = Date.now();
  const batch = db.batch();
  let writes = 0;
  for (const doc of snap.docs) {
    const b = doc.data() as MiningUserBoosterDoc;
    if (b.expiresAt.toMillis() <= now) {
      batch.update(doc.ref, { status: 'expired' });
      writes += 1;
    }
  }
  if (writes > 0) await batch.commit();
}

export async function createBoosterPurchase(params: {
  userId: string;
  walletAddress: string;
  boosterId: string;
}): Promise<MiningBoosterPurchaseDoc> {
  const db = getDb();
  const config = await getMiningConfig();
  const paymentWallet = config.boosterPaymentWallet;
  if (!paymentWallet) {
    throw new AppError(
      'failed-precondition',
      'Admin has not configured a booster payment wallet yet',
    );
  }

  const boosterSnap = await db.collection(Collections.miningBoosters).doc(params.boosterId).get();
  if (!boosterSnap.exists) throw new AppError('not-found', 'Booster not found');
  const booster = boosterSnap.data() as MiningBoosterDoc;
  if (!booster.enabled) throw new AppError('failed-precondition', 'Booster is disabled');

  const baseWei = fromMinorString(booster.priceUsdtWei);
  const expectedWei = uniqueExpectedWei(baseWei);
  const purchaseId = randomUUID();
  const now = Date.now();
  const purchase: MiningBoosterPurchaseDoc = {
    purchaseId,
    userId: params.userId,
    walletAddress: params.walletAddress.toLowerCase(),
    boosterId: booster.boosterId,
    boosterName: booster.name,
    bonusRatePerHourMinor: booster.bonusRatePerHourMinor,
    boostDurationSeconds: booster.durationSeconds,
    expectedUsdtWei: toMinorString(expectedWei),
    priceUsdt: formatMinor(expectedWei, USDT_DECIMALS),
    paymentToken: 'USDT_BEP20',
    paymentWallet: paymentWallet.toLowerCase(),
    status: 'awaiting_payment',
    transactionHash: null,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Timestamp.fromMillis(now + PURCHASE_TTL_MS),
    paidAt: null,
    activatedAt: null,
  };
  await db.collection(Collections.miningBoosterPurchases).doc(purchaseId).set(purchase);
  return purchase;
}

async function markTxUsed(txHash: string, purchaseId: string) {
  const db = getDb();
  const ref = db.collection(Collections.usedCryptoTx).doc(txHash.toLowerCase());
  const snap = await ref.get();
  if (snap.exists) throw new AppError('already-exists', 'This transaction was already used');
  await ref.set({
    txHash: txHash.toLowerCase(),
    purpose: 'mining_booster',
    purchaseId,
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function activatePurchase(
  purchase: MiningBoosterPurchaseDoc,
  txHash: string,
): Promise<MiningUserBoosterDoc> {
  const db = getDb();
  const purchaseRef = db.collection(Collections.miningBoosterPurchases).doc(purchase.purchaseId);
  const userBoosterId = randomUUID();
  const now = Date.now();
  const expiresAt = Timestamp.fromMillis(now + purchase.boostDurationSeconds * 1000);
  const userBooster: MiningUserBoosterDoc = {
    userBoosterId,
    userId: purchase.userId,
    boosterId: purchase.boosterId,
    purchaseId: purchase.purchaseId,
    boosterName: purchase.boosterName,
    bonusRatePerHourMinor: purchase.bonusRatePerHourMinor,
    status: 'active',
    activatedAt: Timestamp.fromMillis(now),
    expiresAt,
  };

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(purchaseRef);
    if (!fresh.exists) throw new AppError('not-found', 'Purchase not found');
    const current = fresh.data() as MiningBoosterPurchaseDoc;
    if (current.status === 'activated') return;
    if (current.status !== 'awaiting_payment') {
      throw new AppError('failed-precondition', `Purchase status is ${current.status}`);
    }
    tx.update(purchaseRef, {
      status: 'activated',
      transactionHash: txHash.toLowerCase(),
      paidAt: FieldValue.serverTimestamp(),
      activatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(db.collection(Collections.miningUserBoosters).doc(userBoosterId), userBooster);
  });

  return userBooster;
}

export async function confirmBoosterPayment(params: {
  userId: string;
  purchaseId: string;
  txHash?: string;
}): Promise<{ purchaseId: string; status: string; userBoosterId?: string }> {
  const db = getDb();
  const ref = db.collection(Collections.miningBoosterPurchases).doc(params.purchaseId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError('not-found', 'Purchase not found');
  const purchase = snap.data() as MiningBoosterPurchaseDoc;
  if (purchase.userId !== params.userId) throw new AppError('permission-denied', 'Not your purchase');
  if (purchase.status === 'activated') {
    return { purchaseId: purchase.purchaseId, status: 'activated' };
  }
  if (purchase.status !== 'awaiting_payment') {
    throw new AppError('failed-precondition', `Cannot confirm purchase in status ${purchase.status}`);
  }
  if (purchase.expiresAt.toMillis() < Date.now()) {
    await ref.update({ status: 'expired_unpaid' });
    throw new AppError('failed-precondition', 'Payment window expired — create a new purchase');
  }

  const expectedWei = fromMinorString(purchase.expectedUsdtWei);
  const notBeforeMs = purchase.expiresAt.toMillis() - PURCHASE_TTL_MS - 60_000;
  const isTxUsed = async (txHash: string) => {
    const used = await db.collection(Collections.usedCryptoTx).doc(txHash.toLowerCase()).get();
    return used.exists;
  };

  let detected = null as Awaited<ReturnType<typeof findIncomingUsdtTransfer>>;
  if (params.txHash) {
    detected = await verifyUsdtDepositTx({
      txHash: params.txHash,
      expectedWei,
      notBeforeMs,
      isTxUsed,
      toAddress: purchase.paymentWallet,
    });
  } else {
    detected = await findIncomingUsdtTransfer({
      expectedWei,
      notBeforeMs,
      isTxUsed,
      toAddress: purchase.paymentWallet,
    });
  }

  if (!detected) {
    throw new AppError(
      'failed-precondition',
      'USDT payment not found yet. Send the exact amount to the payment wallet, wait for confirmations, then try again.',
    );
  }

  await markTxUsed(detected.txHash, purchase.purchaseId);
  const activated = await activatePurchase(purchase, detected.txHash);
  return {
    purchaseId: purchase.purchaseId,
    status: 'activated',
    userBoosterId: activated.userBoosterId,
  };
}

export async function adminListBoosterPurchases(opts?: {
  status?: string;
  limit?: number;
}) {
  const db = getDb();
  let q: FirebaseFirestore.Query = db.collection(Collections.miningBoosterPurchases);
  if (opts?.status) q = q.where('status', '==', opts.status);
  q = q.orderBy('createdAt', 'desc').limit(Math.min(opts?.limit ?? 50, 100));
  const snap = await q.get();
  return snap.docs.map((d) => {
    const p = d.data() as MiningBoosterPurchaseDoc;
    return {
      purchaseId: p.purchaseId,
      userId: p.userId,
      walletAddress: p.walletAddress,
      boosterId: p.boosterId,
      boosterName: p.boosterName,
      bonusRatePerHour: formatMinor(fromMinorString(p.bonusRatePerHourMinor)),
      priceUsdt: p.priceUsdt,
      paymentWallet: p.paymentWallet,
      status: p.status,
      transactionHash: p.transactionHash ?? null,
      createdAtMillis: (p.createdAt as FirebaseFirestore.Timestamp).toMillis?.() ?? null,
      activatedAtMillis: p.activatedAt?.toMillis?.() ?? null,
    };
  });
}

export async function adminBoosterStats() {
  const db = getDb();
  const [catalog, activeBoosts, purchases, activated] = await Promise.all([
    db.collection(Collections.miningBoosters).get(),
    db.collection(Collections.miningUserBoosters).where('status', '==', 'active').get(),
    db.collection(Collections.miningBoosterPurchases).get(),
    db.collection(Collections.miningBoosterPurchases).where('status', '==', 'activated').get(),
  ]);

  const now = Date.now();
  let currentlyActive = 0;
  for (const doc of activeBoosts.docs) {
    const b = doc.data() as MiningUserBoosterDoc;
    if (b.expiresAt.toMillis() > now) currentlyActive += 1;
  }

  let revenueWei = 0n;
  for (const doc of activated.docs) {
    const p = doc.data() as MiningBoosterPurchaseDoc;
    revenueWei += fromMinorString(p.expectedUsdtWei);
  }

  return {
    catalogCount: catalog.size,
    enabledCatalogCount: catalog.docs.filter((d) => (d.data() as MiningBoosterDoc).enabled).length,
    activeBoosters: currentlyActive,
    totalPurchases: purchases.size,
    activatedPurchases: activated.size,
    awaitingPayment: purchases.docs.filter(
      (d) => (d.data() as MiningBoosterPurchaseDoc).status === 'awaiting_payment',
    ).length,
    totalRevenueUsdt: formatMinor(revenueWei, USDT_DECIMALS),
  };
}

export async function adminListActiveBoosters(limit = 100) {
  const db = getDb();
  await expireStaleActiveBoostersBatch();
  const snap = await db
    .collection(Collections.miningUserBoosters)
    .where('status', '==', 'active')
    .orderBy('expiresAt', 'asc')
    .limit(Math.min(limit, 200))
    .get();
  return snap.docs.map((d) => {
    const b = d.data() as MiningUserBoosterDoc;
    return {
      userBoosterId: b.userBoosterId,
      userId: b.userId,
      boosterId: b.boosterId,
      boosterName: b.boosterName,
      bonusRatePerHour: formatMinor(fromMinorString(b.bonusRatePerHourMinor)),
      purchaseId: b.purchaseId,
      activatedAtMillis: b.activatedAt.toMillis(),
      expiresAtMillis: b.expiresAt.toMillis(),
      status: b.status,
    };
  });
}

async function expireStaleActiveBoostersBatch() {
  const db = getDb();
  const snap = await db
    .collection(Collections.miningUserBoosters)
    .where('status', '==', 'active')
    .where('expiresAt', '<=', Timestamp.now())
    .limit(200)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.docs.forEach((d) => batch.update(d.ref, { status: 'expired' }));
  await batch.commit();
}
