import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { AppError } from '../../lib/errors';
import { getDb } from '../../lib/firebase';
import {
  adminBoosterStats,
  adminDeleteBooster,
  adminListActiveBoosters,
  adminListBoosterPurchases,
  adminUpsertBooster,
  confirmBoosterPayment,
  createBoosterPurchase,
  listBoosters,
  setBoosterPaymentWallet,
  weiToUsdtDisplay,
} from './boosters';
import { formatMinor, fromMinorString } from './money';

function requireUid(request: { auth?: { uid: string } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new AppError('unauthenticated', 'Sign in required');
  return uid;
}

function isAdmin(auth: { token?: Record<string, unknown> } | undefined): boolean {
  const role = auth?.token?.adminRole;
  return typeof role === 'string' && role.length > 0;
}

async function requireActiveWalletUser(uid: string): Promise<{ walletAddress: string }> {
  const snap = await getDb().collection('users').doc(uid).get();
  if (!snap.exists) throw new AppError('failed-precondition', 'User profile missing');
  const data = snap.data()!;
  if (data.accountStatus === 'suspended') {
    throw new AppError('permission-denied', 'Account suspended');
  }
  const walletAddress = String(data.walletAddress ?? '');
  if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    throw new AppError('failed-precondition', 'Wallet address not linked');
  }
  return { walletAddress };
}

export const listMiningBoosters = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const includeDisabled = Boolean(request.auth && isAdmin(request.auth) && request.data?.includeDisabled);
    const items = await listBoosters(includeDisabled);
    return {
      items: items.map((b) => ({
        boosterId: b.boosterId,
        name: b.name,
        description: b.description,
        bonusRatePerHour: formatMinor(fromMinorString(b.bonusRatePerHourMinor)),
        durationSeconds: b.durationSeconds,
        priceUsdt: b.priceUsdt || weiToUsdtDisplay(b.priceUsdtWei),
        paymentToken: b.paymentToken,
        enabled: b.enabled,
        sortOrder: b.sortOrder,
      })),
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const purchaseMiningBooster = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    const { walletAddress } = await requireActiveWalletUser(uid);
    const parsed = z
      .object({ boosterId: z.string().min(8) })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'boosterId required');
    const purchase = await createBoosterPurchase({
      userId: uid,
      walletAddress,
      boosterId: parsed.data.boosterId,
    });
    return {
      purchaseId: purchase.purchaseId,
      boosterName: purchase.boosterName,
      priceUsdt: purchase.priceUsdt,
      expectedUsdtWei: purchase.expectedUsdtWei,
      paymentToken: purchase.paymentToken,
      paymentWallet: purchase.paymentWallet,
      expiresAtMillis: purchase.expiresAt.toMillis(),
      status: purchase.status,
      note: 'Send the exact USDT (BEP-20) amount to paymentWallet. Boost activates only after on-chain confirmation.',
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const confirmMiningBoosterPayment = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    await requireActiveWalletUser(uid);
    const parsed = z
      .object({
        purchaseId: z.string().min(8),
        txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid confirm request');
    return await confirmBoosterPayment({
      userId: uid,
      purchaseId: parsed.data.purchaseId,
      txHash: parsed.data.txHash,
    });
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminUpsertMiningBooster = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    const parsed = z
      .object({
        boosterId: z.string().min(8).optional(),
        name: z.string().min(2).max(80),
        description: z.string().max(500).optional(),
        bonusRatePerHour: z.string().min(1),
        durationSeconds: z.number().int().min(60).max(86400 * 30),
        priceUsdt: z.string().min(1),
        enabled: z.boolean().optional(),
        sortOrder: z.number().int().optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid booster');
    return await adminUpsertBooster(parsed.data);
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminDeleteMiningBooster = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    const parsed = z.object({ boosterId: z.string().min(8) }).safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'boosterId required');
    await adminDeleteBooster(parsed.data.boosterId);
    return { ok: true };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminSetBoosterPaymentWallet = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    const parsed = z
      .object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Valid wallet address required');
    const wallet = await setBoosterPaymentWallet(parsed.data.address);
    return { boosterPaymentWallet: wallet };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminListBoosterHistory = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    const parsed = z
      .object({
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid request');
    return { items: await adminListBoosterPurchases(parsed.data) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminListActiveUserBoosters = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    return { items: await adminListActiveBoosters() };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminGetBoosterStats = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    return await adminBoosterStats();
  } catch (err) {
    throw toHttpsError(err);
  }
});
