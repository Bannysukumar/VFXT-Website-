import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
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
} from '../../lib/idempotency';
import { log } from '../../lib/logger';
import { DepositRequest } from '../../types/models';
import { walletDocId } from '../wallets/types';
import { ensureUserWallets } from '../wallets/handlers';
import { createNotification } from '../notifications/handlers';
import { writeAuditLog } from '../audit/handlers';
import { gateEmailVerifiedForFinance } from '../auth/helpers';
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
}> {
  const ctx = requireAuth(request);
  gateEmailVerifiedForFinance(ctx);

  const parsed = createDepositRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { amount, amountMinor: amountMinorInput, method, reference, note } =
    parsed.data;
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
    const { usdCentsToVfxtTokens } = await import('../../config/plan');
    const minTokens = Math.max(
      1,
      usdCentsToVfxtTokens(depositSettings.minDepositUsdCents, tokenFx.tokensPerUsd),
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
  // Primary credit target: fund (USD) for USDT; VFXT wallet for token deposits.
  const walletId = walletDocId(ctx.uid, wantVfxt ? 'vfxt' : 'fund');
  const walletSnap = await db.collection(Collections.wallets).doc(walletId).get();
  if (!walletSnap.exists) {
    throw new AppError('not-found', wantVfxt ? 'VFXT wallet not found' : 'Fund wallet not found');
  }

  const depositId = uuidv4();
  const useCrypto =
    method === 'usdt_bep20' ||
    method === 'vfxt_bep20' ||
    method === 'manual' ||
    !method;

  let depositAddress: string | null = null;
  let expectedWei: string | null = null;
  let chainId: number | null = null;
  let status: DepositRequest['status'] = 'pending';
  let resolvedMethod = method || 'manual';
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

  const doc: DepositRequest = {
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
    expiresAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection(Collections.deposits).doc(depositId).set(doc);
  log.info('deposit_requested', {
    depositId,
    uid: ctx.uid,
    amountMinor,
    currency,
    method: resolvedMethod,
    paymentTag,
    expectedWei,
    tokenSymbol,
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

  const { depositId } = parsed.data;
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

    const vfxtTokens = usdCentsToVfxtTokens(deposit.amountMinor, tokenFx.tokensPerUsd);

    // Always credit fund wallet (legacy deposit.walletId ignored on approve).
    const fundWalletId = walletDocId(deposit.userId, 'fund');
    const { applyLedgerEntries } = await import('../wallets/ledger');
    type LedgerMutation = Parameters<typeof applyLedgerEntries>[2][number];
    const mutations: LedgerMutation[] = [
      {
        userId: deposit.userId,
        walletId: fundWalletId,
        type: 'deposit_credit',
        direction: 'credit',
        amountMinor: deposit.amountMinor,
        availableDelta: deposit.amountMinor,
        reservedDelta: 0,
        currency: 'USD',
        referenceType: 'deposit',
        referenceId: depositId,
        description: `Deposit approved (${deposit.method})`,
        createdBy: ctx.uid,
        metadata: {
          method: deposit.method,
          vfxtTokens,
          tokensPerUsd: tokenFx.tokensPerUsd,
        },
      },
    ];
    if (vfxtTokens > 0) {
      mutations.push({
        userId: deposit.userId,
        walletId: walletDocId(deposit.userId, 'vfxt'),
        type: 'deposit_credit',
        direction: 'credit',
        amountMinor: vfxtTokens,
        availableDelta: vfxtTokens,
        reservedDelta: 0,
        currency: 'VFXT',
        referenceType: 'deposit',
        referenceId: depositId,
        description: `VFXT credited from deposit (${tokenFx.tokensPerUsd}/$1)`,
        createdBy: ctx.uid,
        metadata: {
          amountUsdCents: deposit.amountMinor,
          tokensPerUsd: tokenFx.tokensPerUsd,
        },
      });
    }
    const credits = await applyLedgerEntries(tx, db, mutations);
    entryId = credits[0]?.entryId ?? '';

    tx.update(depositRef, {
      status: 'approved',
      walletId: fundWalletId,
      currency: 'USD',
      vfxtTokensCredited: vfxtTokens,
      tokensPerUsd: tokenFx.tokensPerUsd,
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
  const vfxtCredited = Number(
    (deposit as DepositRequest & { vfxtTokensCredited?: number }).vfxtTokensCredited ?? 0,
  );
  await createNotification({
    userId: deposit.userId,
    type: 'deposit_approved',
    title: 'Deposit approved',
    body:
      vfxtCredited > 0
        ? `Deposit credited: $${(deposit.amountMinor / 100).toFixed(2)} + ${vfxtCredited.toLocaleString()} VFXT (ready to stake).`
        : `Your deposit of $${(deposit.amountMinor / 100).toFixed(2)} has been credited.`,
    data: { depositId, vfxtTokens: vfxtCredited },
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
