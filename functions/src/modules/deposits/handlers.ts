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
import { creditAvailable } from '../wallets/ledger';
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
  // Deposits always credit the fund wallet (USD cents).
  const currency = 'USD' as const;
  const amountMinor =
    amountMinorInput ?? parseAmountToMinor(amount ?? '0', 2);
  assertPositiveMinor(amountMinor);

  const db = getDb();
  await ensureUserWallets(db, ctx.uid);
  const walletId = walletDocId(ctx.uid, 'fund');
  const walletSnap = await db.collection(Collections.wallets).doc(walletId).get();
  if (!walletSnap.exists) {
    throw new AppError('not-found', 'Fund wallet not found');
  }

  const depositId = uuidv4();
  const useCrypto = method === 'usdt_bep20' || method === 'manual' || !method;

  let depositAddress: string | null = null;
  let expectedWei: string | null = null;
  let chainId: number | null = null;
  let status: DepositRequest['status'] = 'pending';
  let resolvedMethod = method || 'manual';

  let amountUsdt = (amountMinor / 100).toFixed(2);
  let paymentTag: number | null = null;
  let qrPayload: string | null = null;

  if (useCrypto) {
    try {
      const { getHotWallet } = await import('../crypto/hot-wallet');
      const { allocateUniqueDepositWei } = await import('../crypto/unique-amount');
      const { BSC_CHAIN_ID, USDT_BEP20_ADDRESS } = await import('../../config/bsc');
      const hot = await getHotWallet();
      const unique = await allocateUniqueDepositWei(db, amountMinor);
      depositAddress = hot.address;
      expectedWei = unique.expectedWei;
      amountUsdt = unique.amountUsdt;
      paymentTag = unique.paymentTag;
      chainId = BSC_CHAIN_ID;
      status = 'awaiting_payment';
      resolvedMethod = 'usdt_bep20';
      // EIP-681 style QR so wallets can prefill the exact unique amount.
      qrPayload = `ethereum:${USDT_BEP20_ADDRESS}@${BSC_CHAIN_ID}/transfer?address=${depositAddress}&uint256=${expectedWei}`;
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
  });

  return {
    depositId,
    status,
    method: resolvedMethod,
    depositAddress,
    amountUsdt,
    amountMinor,
    network: depositAddress ? 'BSC (BEP-20)' : null,
    token: depositAddress ? 'USDT' : null,
    tokenAddress: depositAddress
      ? '0x55d398326f99059fF775485246999027B3197955'
      : null,
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

    // Always credit fund wallet (legacy deposit.walletId ignored on approve).
    const fundWalletId = walletDocId(deposit.userId, 'fund');
    const credit = await creditAvailable(tx, db, {
      userId: deposit.userId,
      walletId: fundWalletId,
      type: 'deposit_credit',
      amountMinor: deposit.amountMinor,
      currency: 'USD',
      referenceType: 'deposit',
      referenceId: depositId,
      description: `Deposit approved (${deposit.method})`,
      createdBy: ctx.uid,
      metadata: { method: deposit.method },
    });
    entryId = credit.entryId;

    tx.update(depositRef, {
      status: 'approved',
      walletId: fundWalletId,
      currency: 'USD',
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
  await createNotification({
    userId: deposit.userId,
    type: 'deposit_approved',
    title: 'Deposit approved',
    body: `Your deposit of ${deposit.amountMinor} minor units has been credited.`,
    data: { depositId },
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
