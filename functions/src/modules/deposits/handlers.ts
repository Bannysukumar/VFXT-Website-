import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  AdminRole,
  requireAuth,
  requireAdminRole,
} from '../../lib/permissions';
import { parseAmountToMinor, assertPositiveMinor } from '../../lib/money';
import {
  buildIdempotencyKey,
  claimIdempotencyKey,
  getIdempotencyRecord,
} from '../../lib/idempotency';
import { log } from '../../lib/logger';
import { DepositRequest } from '../../types/models';
import { walletDocId } from '../wallets/types';
import { ensureUserWallets } from '../wallets/handlers';
import { createNotification } from '../notifications/handlers';
import { writeAuditLog } from '../audit/handlers';
import {
  gateEmailVerifiedForFinance,
  requireActiveMember,
} from '../auth/helpers';
import { assertRateLimit, rateLimitKey } from '../../lib/rate-limit';
import {
  approveDepositSchema,
  createDepositRequestSchema,
  rejectDepositSchema,
} from './schemas';

async function handleCreateDepositRequest(
  request: CallableRequest,
): Promise<{
  depositId: string;
  status: string;
  method: string;
  depositAddress: string | null;
  amountUsdt: string;
  amountMinor: number;
  network: string | null;
  token: string | null;
  tokenAddress: string | null;
  qrPayload: string | null;
  chainId: number | null;
  expectedWei: string | null;
  paymentTag: number | null;
  expiresAt: string | null;
  expiresAtMs: number | null;
  ttlMs: number;
}> {
  const ctx = requireAuth(request);
  assertRateLimit(rateLimitKey(request, 'deposit.create'), 8, 60_000);
  await requireActiveMember(ctx.uid);
  await gateEmailVerifiedForFinance(ctx);

  const parsed = createDepositRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const {
    amount,
    amountMinor: amountMinorInput,
    method,
    reference,
    note,
    idempotencyKey,
  } = parsed.data;
  const wantVfxt = method === 'vfxt_bep20';
  // USDT deposits: amountMinor = USD cents. VFXT deposits: amountMinor = whole tokens.
  const currency = wantVfxt ? ('VFXT' as const) : ('USD' as const);
  const amountMinor =
    amountMinorInput ??
    (wantVfxt
      ? Math.floor(Number(amount ?? '0'))
      : parseAmountToMinor(amount ?? '0', 2));
  assertPositiveMinor(amountMinor);

  const { getDepositSettings } = await import('../platform/store');
  const { getTokenEconomicsSettings } = await import('../platform/store');
  const depositSettings = await getDepositSettings();
  const tokenFx = await getTokenEconomicsSettings();
  if (wantVfxt) {
    const { usdCentsToVfxtTokens, minVfxtTokensForOneCent } =
      await import('../../config/plan');
    // Admin Min VFXT deposit is authoritative; dust floor only when unset.
    const configuredVfxtMin = depositSettings.minVfxtDepositTokens;
    const minTokens = Math.max(
      1,
      Number.isFinite(configuredVfxtMin) && configuredVfxtMin > 0
        ? Math.floor(configuredVfxtMin)
        : Math.max(
            usdCentsToVfxtTokens(depositSettings.minDepositUsdCents, tokenFx.tokensPerUsd),
            minVfxtTokensForOneCent(tokenFx.tokensPerUsd),
          ),
    );
    if (amountMinor < minTokens) {
      throw new AppError(
        'invalid-argument',
        `Minimum VFXT deposit is ${minTokens.toLocaleString()} tokens`,
      );
    }
  } else if (amountMinor < depositSettings.minDepositUsdCents) {
    throw new AppError(
      'invalid-argument',
      `Minimum deposit is $${(depositSettings.minDepositUsdCents / 100).toFixed(2)}`,
    );
  }

  const db = getDb();
  await ensureUserWallets(db, ctx.uid);
  // All deposits credit Fund Wallet (USD) after payment / approval.
  const walletId = walletDocId(ctx.uid, 'fund');
  const walletSnap = await db.collection(Collections.wallets).doc(walletId).get();
  if (!walletSnap.exists) {
    throw new AppError('not-found', 'Fund wallet not found');
  }

  // Idempotent create — same key returns the original deposit (never a new one).
  // Different payload with the same key is rejected.
  const idemDocId = buildIdempotencyKey('deposit.create', idempotencyKey, ctx.uid);
  const fingerprint = `${method}|${amountMinor}|${currency}`;
  const existingIdem = await getIdempotencyRecord(db, idemDocId);
  if (existingIdem) {
    const priorFp = (existingIdem as { fingerprint?: string }).fingerprint;
    if (priorFp && priorFp !== fingerprint) {
      throw new AppError(
        'already-exists',
        'This idempotency key was already used with a different deposit request',
      );
    }
    if (existingIdem.resultRef) {
      const existingSnap = await db
        .collection(Collections.deposits)
        .doc(String(existingIdem.resultRef))
        .get();
      if (existingSnap.exists) {
        const d = existingSnap.data() as DepositRequest;
        const { DEPOSIT_TTL_MS } = await import('../../config/bsc');
        const exp = d.expiresAt as { toMillis?: () => number } | null;
        const expiresAtMs =
          exp && typeof exp.toMillis === 'function' ? exp.toMillis() : null;
        return {
          depositId: d.depositId,
          status: d.status,
          method: d.method,
          depositAddress: d.depositAddress ?? null,
          amountUsdt:
            d.currency === 'VFXT'
              ? String(d.amountMinor)
              : (d.amountMinor / 100).toFixed(2),
          amountMinor: d.amountMinor,
          network: d.depositAddress ? 'BSC (BEP-20)' : null,
          token: d.tokenSymbol ?? null,
          tokenAddress: d.tokenAddress ?? null,
          qrPayload:
            d.tokenAddress && d.depositAddress && d.expectedWei && d.chainId
              ? `ethereum:${d.tokenAddress}@${d.chainId}/transfer?address=${d.depositAddress}&uint256=${d.expectedWei}`
              : null,
          chainId: d.chainId ?? null,
          expectedWei: d.expectedWei ?? null,
          paymentTag: d.paymentTag ?? null,
          expiresAt: expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null,
          expiresAtMs,
          ttlMs: DEPOSIT_TTL_MS,
        };
      }
    }
  }

  // Do NOT auto-cancel prior awaiting_payment deposits — chain payments to an
  // older intent must still be matchable until TTL expiry.
  const openCrypto = await db
    .collection(Collections.deposits)
    .where('userId', '==', ctx.uid)
    .where('status', 'in', ['awaiting_payment'])
    .limit(5)
    .get();
  if (openCrypto.size >= 3) {
    throw new AppError(
      'failed-precondition',
      'You already have open deposit payments. Wait for them to expire or complete before creating another.',
    );
  }

  const depositId = uuidv4();
  const useCrypto = method === 'usdt_bep20' || method === 'vfxt_bep20';

  let depositAddress: string | null = null;
  let expectedWei: string | null = null;
  let chainId: number | null = null;
  let status: DepositRequest['status'] = 'pending';
  let resolvedMethod: string = method;
  let tokenSymbol: string | null = null;
  let tokenAddress: string | null = null;
  let tokensPerUsdUsed: number | null = wantVfxt ? tokenFx.tokensPerUsd : null;

  let amountUsdt = wantVfxt ? String(amountMinor) : (amountMinor / 100).toFixed(2);
  let paymentTag: number | null = null;
  let qrPayload: string | null = null;

  if (useCrypto) {
    try {
      const { pickDepositHotWallet } = await import('../crypto/hot-wallet');
      const { allocateUniqueDepositWei } = await import('../crypto/unique-amount');
      const {
        BSC_CHAIN_ID,
        USDT_BEP20_ADDRESS,
        VFXT_BEP20_ADDRESS,
      } = await import('../../config/bsc');
      const hot = await pickDepositHotWallet();
      const asset = wantVfxt ? 'VFXT' : 'USDT';
      const unique = await allocateUniqueDepositWei(db, amountMinor, { asset });
      depositAddress = hot.address;
      expectedWei = unique.expectedWei;
      amountUsdt = unique.amountDisplay;
      paymentTag = unique.paymentTag;
      chainId = BSC_CHAIN_ID;
      status = 'awaiting_payment';
      resolvedMethod = wantVfxt ? 'vfxt_bep20' : 'usdt_bep20';
      tokenSymbol = asset;
      tokenAddress = wantVfxt ? VFXT_BEP20_ADDRESS : USDT_BEP20_ADDRESS;
      // EIP-681 style QR so wallets can prefill the exact unique amount.
      qrPayload = `ethereum:${tokenAddress}@${BSC_CHAIN_ID}/transfer?address=${depositAddress}&uint256=${expectedWei}`;
    } catch (err) {
      if (err instanceof AppError && err.code === 'resource-exhausted') {
        throw err;
      }
      // Hot wallet not configured — fall back to manual admin approval.
      status = 'pending';
      resolvedMethod = 'manual';
    }
  }

  const { DEPOSIT_TTL_MS } = await import('../../config/bsc');
  const expiresAtMs =
    status === 'awaiting_payment' ? Date.now() + DEPOSIT_TTL_MS : null;

  const doc: DepositRequest & { idempotencyKey?: string } = {
    depositId,
    userId: ctx.uid,
    walletId,
    currency,
    amountMinor,
    status,
    method: resolvedMethod,
    reference: reference ?? null,
    note: note ?? null,
    reviewedBy: null,
    reviewedAt: null,
    rejectionReason: null,
    depositAddress,
    expectedWei,
    paymentTag,
    txHash: null,
    chainId,
    tokenSymbol,
    tokenAddress,
    tokensPerUsd: tokensPerUsdUsed,
    expiresAt: expiresAtMs != null ? Timestamp.fromMillis(expiresAtMs) : null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    idempotencyKey,
  };

  await db.collection(Collections.deposits).doc(depositId).set(doc);
  const idemRef = db.collection(Collections.idempotencyKeys).doc(idemDocId);
  try {
    await idemRef.create({
      key: idemDocId,
      operation: 'deposit.create',
      actorId: ctx.uid,
      fingerprint,
      resultRef: depositId,
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch {
    // Concurrent create with the same key — keep the winner, drop this orphan.
    await db.collection(Collections.deposits).doc(depositId).delete().catch(() => undefined);
    const winner = await getIdempotencyRecord(db, idemDocId);
    if (winner?.resultRef) {
      const snap = await db.collection(Collections.deposits).doc(String(winner.resultRef)).get();
      if (snap.exists) {
        const d = snap.data() as DepositRequest;
        const exp = d.expiresAt as { toMillis?: () => number } | null;
        const expiresAtMs =
          exp && typeof exp.toMillis === 'function' ? exp.toMillis() : null;
        return {
          depositId: d.depositId,
          status: d.status,
          method: d.method,
          depositAddress: d.depositAddress ?? null,
          amountUsdt:
            d.currency === 'VFXT'
              ? String(d.amountMinor)
              : (d.amountMinor / 100).toFixed(2),
          amountMinor: d.amountMinor,
          network: d.depositAddress ? 'BSC (BEP-20)' : null,
          token: d.tokenSymbol ?? null,
          tokenAddress: d.tokenAddress ?? null,
          qrPayload:
            d.tokenAddress && d.depositAddress && d.expectedWei && d.chainId
              ? `ethereum:${d.tokenAddress}@${d.chainId}/transfer?address=${d.depositAddress}&uint256=${d.expectedWei}`
              : null,
          chainId: d.chainId ?? null,
          expectedWei: d.expectedWei ?? null,
          paymentTag: d.paymentTag ?? null,
          expiresAt: expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null,
          expiresAtMs,
          ttlMs: DEPOSIT_TTL_MS,
        };
      }
    }
    throw new AppError('aborted', 'Deposit create raced — retry with the same idempotency key');
  }
  log.info('deposit_requested', {
    depositId,
    uid: ctx.uid,
    amountMinor,
    currency,
    method: resolvedMethod,
    paymentTag,
    expectedWei,
    tokenSymbol,
    expiresAtMs,
    idempotencyKey,
  });

  return {
    depositId,
    status,
    method: resolvedMethod,
    depositAddress,
    amountUsdt,
    amountMinor,
    network: depositAddress ? 'BSC (BEP-20)' : null,
    token: tokenSymbol,
    tokenAddress,
    qrPayload,
    chainId,
    expectedWei,
    paymentTag,
    expiresAt: expiresAtMs != null ? new Date(expiresAtMs).toISOString() : null,
    expiresAtMs,
    ttlMs: DEPOSIT_TTL_MS,
  };
}

export const createDepositRequest = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleCreateDepositRequest(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleApproveDeposit(
  request: CallableRequest,
): Promise<{ depositId: string; entryId: string }> {
  const ctx = requireAdminRole(request, [
    AdminRole.SuperAdmin,
    AdminRole.FinanceAdmin,
  ]);

  const parsed = approveDepositSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { depositId, creditAmountMinor } = parsed.data;
  const idemKey =
    parsed.data.idempotencyKey ??
    buildIdempotencyKey('deposit.approve', depositId, ctx.uid);

  const db = getDb();
  let entryId = '';

  const { getTokenEconomicsSettings } = await import('../platform/store');
  const { usdCentsToVfxtTokens } = await import('../../config/plan');
  const tokenFx = await getTokenEconomicsSettings();

  const depositPreview = await db.collection(Collections.deposits).doc(depositId).get();
  if (!depositPreview.exists) throw new AppError('not-found', 'Deposit not found');
  await ensureUserWallets(db, (depositPreview.data() as DepositRequest).userId);

  await db.runTransaction(async (tx) => {
    const depositRef = db.collection(Collections.deposits).doc(depositId);
    const depositSnap = await tx.get(depositRef);
    if (!depositSnap.exists) {
      throw new AppError('not-found', 'Deposit not found');
    }

    const deposit = depositSnap.data() as DepositRequest;
    if (deposit.status !== 'pending') {
      throw new AppError(
        'failed-precondition',
        `Deposit status is ${deposit.status}, expected pending`,
      );
    }

    await claimIdempotencyKey(
      tx,
      db,
      idemKey,
      'deposit.approve',
      ctx.uid,
      depositId,
    );

    const isVfxt =
      deposit.method === 'vfxt_bep20' ||
      deposit.currency === 'VFXT' ||
      deposit.tokenSymbol === 'VFXT';
    const paidMinor =
      creditAmountMinor != null && Number.isFinite(creditAmountMinor)
        ? Math.floor(creditAmountMinor)
        : deposit.amountMinor;
    if (!Number.isInteger(paidMinor) || paidMinor < 1) {
      throw new AppError('invalid-argument', 'Credit amount must be a positive integer');
    }

    const fundTokens = isVfxt
      ? paidMinor
      : usdCentsToVfxtTokens(paidMinor, tokenFx.tokensPerUsd);
    if (!Number.isFinite(fundTokens) || fundTokens < 1) {
      throw new AppError(
        'failed-precondition',
        'Deposit amount too small to credit Fund Wallet',
      );
    }

    // Always credit Fund Wallet in VFXT tokens only (never VFXT Wallet).
    const fundWalletId = walletDocId(deposit.userId, 'fund');
    const { applyLedgerEntries } = await import('../wallets/ledger');
    const credits = await applyLedgerEntries(tx, db, [
      {
        userId: deposit.userId,
        walletId: fundWalletId,
        type: 'deposit_credit',
        direction: 'credit',
        amountMinor: fundTokens,
        availableDelta: fundTokens,
        reservedDelta: 0,
        currency: 'VFXT',
        referenceType: 'deposit',
        referenceId: depositId,
        description: `Deposit approved (${deposit.method})`,
        createdBy: ctx.uid,
        metadata: {
          method: deposit.method,
          tokensPerUsd: tokenFx.tokensPerUsd,
          paidUsdtCents: isVfxt ? null : paidMinor,
          paidVfxtTokens: isVfxt ? paidMinor : null,
          requestedAmountMinor: deposit.amountMinor,
          creditAmountMinor: paidMinor,
          manualReview: Boolean((deposit as DepositRequest & { manualReview?: boolean }).manualReview),
          txHash: deposit.txHash ?? null,
          fundTokensCredited: fundTokens,
          fundCentsCredited: fundTokens,
        },
      },
    ]);
    entryId = credits[0]?.entryId ?? '';

    const txHash =
      typeof deposit.txHash === 'string' && deposit.txHash.startsWith('0x')
        ? deposit.txHash.toLowerCase()
        : null;
    if (txHash) {
      const usedRef = db.collection(Collections.usedCryptoTx).doc(txHash);
      tx.set(
        usedRef,
        {
          txHash,
          depositId,
          userId: deposit.userId,
          pendingManualReview: false,
          approvedBy: ctx.uid,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    tx.update(depositRef, {
      status: 'approved',
      walletId: fundWalletId,
      currency: 'VFXT',
      amountMinor: paidMinor,
      requestedAmountMinor: deposit.amountMinor,
      creditAmountMinor: paidMinor,
      vfxtTokensCredited: fundTokens,
      fundTokensCredited: fundTokens,
      fundCentsCredited: fundTokens,
      tokensPerUsd: tokenFx.tokensPerUsd,
      manualReview: Boolean((deposit as DepositRequest & { manualReview?: boolean }).manualReview),
      reviewedBy: ctx.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    actorId: ctx.uid,
    action: 'deposit.approve',
    resourceType: 'deposit',
    resourceId: depositId,
    metadata: { entryId },
  });

  const depositSnap = await db
    .collection(Collections.deposits)
    .doc(depositId)
    .get();
  const deposit = depositSnap.data() as DepositRequest;
  const fundCredited = Number(
    (deposit as DepositRequest & { fundTokensCredited?: number; fundCentsCredited?: number })
      .fundTokensCredited ??
      (deposit as DepositRequest & { fundCentsCredited?: number }).fundCentsCredited ??
      deposit.amountMinor,
  );
  await createNotification({
    userId: deposit.userId,
    type: 'deposit_approved',
    title: 'Deposit approved',
    body: `Your deposit of ${fundCredited.toLocaleString()} VFXT has been credited to Fund Wallet.`,
    data: { depositId, fundTokens: fundCredited, fundCents: fundCredited },
  });

  log.info('deposit_approved', { depositId, entryId, actorId: ctx.uid });
  return { depositId, entryId };
}

export const approveDeposit = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleApproveDeposit(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleRejectDeposit(
  request: CallableRequest,
): Promise<{ depositId: string }> {
  const ctx = requireAdminRole(request, [
    AdminRole.SuperAdmin,
    AdminRole.FinanceAdmin,
  ]);

  const parsed = rejectDepositSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { depositId, reason } = parsed.data;
  const db = getDb();

  await db.runTransaction(async (tx) => {
    const depositRef = db.collection(Collections.deposits).doc(depositId);
    const depositSnap = await tx.get(depositRef);
    if (!depositSnap.exists) {
      throw new AppError('not-found', 'Deposit not found');
    }
    const deposit = depositSnap.data() as DepositRequest;
    if (deposit.status !== 'pending') {
      throw new AppError(
        'failed-precondition',
        `Deposit status is ${deposit.status}, expected pending`,
      );
    }
    const txHash =
      typeof deposit.txHash === 'string' && deposit.txHash.startsWith('0x')
        ? deposit.txHash.toLowerCase()
        : null;
    if (txHash) {
      const usedRef = db.collection(Collections.usedCryptoTx).doc(txHash);
      const usedSnap = await tx.get(usedRef);
      if (
        usedSnap.exists &&
        usedSnap.data()?.depositId === depositId &&
        usedSnap.data()?.pendingManualReview
      ) {
        tx.delete(usedRef);
      }
    }
    tx.update(depositRef, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: ctx.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  const depositSnap = await db
    .collection(Collections.deposits)
    .doc(depositId)
    .get();
  const deposit = depositSnap.data() as DepositRequest;

  await writeAuditLog({
    actorId: ctx.uid,
    action: 'deposit.reject',
    resourceType: 'deposit',
    resourceId: depositId,
    metadata: { reason },
  });

  await createNotification({
    userId: deposit.userId,
    type: 'deposit_rejected',
    title: 'Deposit rejected',
    body: reason,
    data: { depositId },
  });

  log.info('deposit_rejected', { depositId, actorId: ctx.uid });
  return { depositId };
}

export const rejectDeposit = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleRejectDeposit(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});
