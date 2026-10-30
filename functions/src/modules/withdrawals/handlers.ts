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
import { WithdrawalRequest, WithdrawalStatus } from '../../types/models';
import { walletDocId } from '../wallets/types';
import { ensureUserWallets } from '../wallets/handlers';
import {
  debitReserved,
  releaseReserved,
  reserveFunds,
} from '../wallets/ledger';
import { createNotification } from '../notifications/handlers';
import { writeAuditLog } from '../audit/handlers';
import { gateEmailVerifiedForFinance } from '../auth/helpers';
import {
  approveWithdrawalSchema,
  completeWithdrawalSchema,
  createWithdrawalRequestSchema,
  rejectWithdrawalSchema,
} from './schemas';

const FINANCE_ROLES = [AdminRole.SuperAdmin, AdminRole.FinanceAdmin] as const;

function assertTransition(
  current: WithdrawalStatus,
  allowed: WithdrawalStatus[],
): void {
  if (!allowed.includes(current)) {
    throw new AppError(
      'failed-precondition',
      `Invalid withdrawal status transition from ${current}`,
      { current, allowed },
    );
  }
}

async function handleCreateWithdrawalRequest(
  request: CallableRequest,
): Promise<{
  withdrawalId: string;
  txHash: string | null;
  status: string;
  amountMinor: number;
  commissionMinor: number;
  netAmountMinor: number;
}> {
  const ctx = requireAuth(request);
  gateEmailVerifiedForFinance(ctx);

  const parsed = createWithdrawalRequestSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { amount, amountMinor: amountMinorInput, destination, method } =
    parsed.data;
  const currency = 'USD' as const;
  const amountMinor =
    amountMinorInput ?? parseAmountToMinor(amount ?? '0', 2);
  assertPositiveMinor(amountMinor);

  const { getWithdrawSettings } = await import('../platform/store');
  const { splitWithdrawalCommission } = await import('../../config/plan');
  const withdrawSettings = await getWithdrawSettings();
  if (amountMinor < withdrawSettings.minWithdrawUsdCents) {
    throw new AppError(
      'invalid-argument',
      `Minimum withdrawal is $${(withdrawSettings.minWithdrawUsdCents / 100).toFixed(2)}`,
    );
  }

  const { commissionMinor, netMinor } = splitWithdrawalCommission(
    amountMinor,
    withdrawSettings.commissionBps,
  );
  if (netMinor <= 0) {
    throw new AppError(
      'invalid-argument',
      'Withdrawal amount too small after commission',
    );
  }

  const { assertBep20Address, sendUsdtBep20 } = await import('../crypto/bsc-usdt');
  const { getHotWalletPublicInfo } = await import('../crypto/hot-wallet');
  const toAddress = assertBep20Address(destination);

  const db = getDb();
  await ensureUserWallets(db, ctx.uid);
  const walletId = walletDocId(ctx.uid, 'withdrawal');
  const withdrawalId = uuidv4();
  const resolvedMethod = method || 'usdt_bep20';

  await db.runTransaction(async (tx) => {
    await reserveFunds(tx, db, {
      userId: ctx.uid,
      walletId,
      type: 'withdrawal_reserve',
      amountMinor,
      currency,
      referenceType: 'withdrawal',
      referenceId: withdrawalId,
      description: `Withdrawal reserved (${resolvedMethod})`,
      createdBy: ctx.uid,
      metadata: {
        destination: toAddress,
        method: resolvedMethod,
        commissionMinor,
        netMinor,
        commissionBps: withdrawSettings.commissionBps,
      },
    });

    const doc: WithdrawalRequest = {
      withdrawalId,
      userId: ctx.uid,
      walletId,
      currency,
      amountMinor,
      commissionMinor,
      netAmountMinor: netMinor,
      commissionBps: withdrawSettings.commissionBps,
      status: 'processing',
      destination: toAddress,
      method: resolvedMethod,
      reviewedBy: null,
      reviewedAt: null,
      completedAt: null,
      rejectionReason: null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    tx.set(db.collection(Collections.withdrawals).doc(withdrawalId), doc);
  });

  const info = await getHotWalletPublicInfo();
  if (!info.configured || info.autoWithdraw === false) {
    await db.collection(Collections.withdrawals).doc(withdrawalId).update({
      status: 'pending',
      updatedAt: FieldValue.serverTimestamp(),
    });
    log.info('withdrawal_queued_manual', { withdrawalId, uid: ctx.uid });
    return {
      withdrawalId,
      txHash: null,
      status: 'pending',
      amountMinor,
      commissionMinor,
      netAmountMinor: netMinor,
    };
  }

  try {
    const { txHash } = await sendUsdtBep20({
      to: toAddress,
      amountUsdCents: netMinor,
    });

    await db.runTransaction(async (tx) => {
      await debitReserved(tx, db, {
        userId: ctx.uid,
        walletId,
        type: 'withdrawal_debit',
        amountMinor,
        currency,
        referenceType: 'withdrawal',
        referenceId: withdrawalId,
        description: `USDT BEP-20 sent ${txHash.slice(0, 10)}… (fee $${(commissionMinor / 100).toFixed(2)})`,
        createdBy: 'system:crypto-withdraw',
        metadata: {
          txHash,
          destination: toAddress,
          commissionMinor,
          netMinor,
          commissionBps: withdrawSettings.commissionBps,
        },
      });
      tx.update(db.collection(Collections.withdrawals).doc(withdrawalId), {
        status: 'completed',
        txHash,
        completedAt: FieldValue.serverTimestamp(),
        reviewedBy: 'system:crypto-withdraw',
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    await db.collection(Collections.users).doc(ctx.uid).set(
      {
        firstWithdrawalCompletedAt: FieldValue.serverTimestamp(),
        lastWithdrawalAddress: toAddress,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    await createNotification({
      userId: ctx.uid,
      type: 'withdrawal_completed',
      title: 'Withdrawal sent',
      body:
        commissionMinor > 0
          ? `Sent $${(netMinor / 100).toFixed(2)} USDT (fee $${(commissionMinor / 100).toFixed(2)}).`
          : 'Your USDT (BEP-20) withdrawal was broadcast on BSC.',
      data: { withdrawalId, txHash, commissionMinor, netMinor },
    });

    log.info('withdrawal_auto_sent', {
      withdrawalId,
      txHash,
      uid: ctx.uid,
      commissionMinor,
      netMinor,
    });
    return {
      withdrawalId,
      txHash,
      status: 'completed',
      amountMinor,
      commissionMinor,
      netAmountMinor: netMinor,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transfer failed';
    await db.runTransaction(async (tx) => {
      await releaseReserved(tx, db, {
        userId: ctx.uid,
        walletId,
        type: 'withdrawal_release',
        amountMinor,
        currency,
        referenceType: 'withdrawal',
        referenceId: withdrawalId,
        description: `Withdrawal failed — funds released`,
        createdBy: 'system:crypto-withdraw',
        metadata: { error: message.slice(0, 500) },
      });
      tx.update(db.collection(Collections.withdrawals).doc(withdrawalId), {
        status: 'failed',
        rejectionReason: message.slice(0, 1000),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    throw new AppError('internal', `Withdrawal transfer failed: ${message}`);
  }
}

export const createWithdrawalRequest = onCall(
  CALLABLE_OPTS,
  async (request) => {
    try {
      return await handleCreateWithdrawalRequest(request);
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);

async function handleApproveWithdrawal(
  request: CallableRequest,
): Promise<{ withdrawalId: string }> {
  const ctx = requireAdminRole(request, [...FINANCE_ROLES]);
  const parsed = approveWithdrawalSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { withdrawalId } = parsed.data;
  const db = getDb();

  await db.runTransaction(async (tx) => {
    const ref = db.collection(Collections.withdrawals).doc(withdrawalId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new AppError('not-found', 'Withdrawal not found');
    }
    const w = snap.data() as WithdrawalRequest;
    assertTransition(w.status, ['pending']);
    tx.update(ref, {
      status: 'approved',
      reviewedBy: ctx.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  // Move approved → processing immediately so ops can complete.
  await db
    .collection(Collections.withdrawals)
    .doc(withdrawalId)
    .update({
      status: 'processing',
      updatedAt: FieldValue.serverTimestamp(),
    });

  await writeAuditLog({
    actorId: ctx.uid,
    action: 'withdrawal.approve',
    resourceType: 'withdrawal',
    resourceId: withdrawalId,
  });

  const wSnap = await db
    .collection(Collections.withdrawals)
    .doc(withdrawalId)
    .get();
  const w = wSnap.data() as WithdrawalRequest;
  await createNotification({
    userId: w.userId,
    type: 'withdrawal_approved',
    title: 'Withdrawal approved',
    body: 'Your withdrawal is being processed.',
    data: { withdrawalId },
  });

  log.info('withdrawal_approved', { withdrawalId, actorId: ctx.uid });
  return { withdrawalId };
}

export const approveWithdrawal = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleApproveWithdrawal(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleCompleteWithdrawal(
  request: CallableRequest,
): Promise<{ withdrawalId: string; entryId: string }> {
  const ctx = requireAdminRole(request, [...FINANCE_ROLES]);
  const parsed = completeWithdrawalSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { withdrawalId } = parsed.data;
  const idemKey =
    parsed.data.idempotencyKey ??
    buildIdempotencyKey('withdrawal.complete', withdrawalId, ctx.uid);

  const db = getDb();
  let entryId = '';

  await db.runTransaction(async (tx) => {
    const ref = db.collection(Collections.withdrawals).doc(withdrawalId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new AppError('not-found', 'Withdrawal not found');
    }
    const w = snap.data() as WithdrawalRequest;
    // Allow complete from approved or processing (ops flow).
    assertTransition(w.status, ['approved', 'processing']);

    await claimIdempotencyKey(
      tx,
      db,
      idemKey,
      'withdrawal.complete',
      ctx.uid,
      withdrawalId,
    );

    const result = await debitReserved(tx, db, {
      userId: w.userId,
      walletId: w.walletId,
      type: 'withdrawal_debit',
      amountMinor: w.amountMinor,
      currency: w.currency,
      referenceType: 'withdrawal',
      referenceId: withdrawalId,
      description: `Withdrawal completed (${w.method})`,
      createdBy: ctx.uid,
      metadata: { destination: w.destination },
    });
    entryId = result.entryId;

    tx.update(ref, {
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    actorId: ctx.uid,
    action: 'withdrawal.complete',
    resourceType: 'withdrawal',
    resourceId: withdrawalId,
    metadata: { entryId },
  });

  const wSnap = await db
    .collection(Collections.withdrawals)
    .doc(withdrawalId)
    .get();
  const w = wSnap.data() as WithdrawalRequest;
  await createNotification({
    userId: w.userId,
    type: 'withdrawal_completed',
    title: 'Withdrawal completed',
    body: 'Your withdrawal has been sent.',
    data: { withdrawalId },
  });

  log.info('withdrawal_completed', {
    withdrawalId,
    entryId,
    actorId: ctx.uid,
  });
  return { withdrawalId, entryId };
}

export const completeWithdrawal = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleCompleteWithdrawal(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleRejectWithdrawal(
  request: CallableRequest,
): Promise<{ withdrawalId: string }> {
  const ctx = requireAdminRole(request, [...FINANCE_ROLES]);
  const parsed = rejectWithdrawalSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { withdrawalId, reason } = parsed.data;
  const db = getDb();

  await db.runTransaction(async (tx) => {
    const ref = db.collection(Collections.withdrawals).doc(withdrawalId);
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new AppError('not-found', 'Withdrawal not found');
    }
    const w = snap.data() as WithdrawalRequest;
    // Rejectable while funds are still reserved.
    assertTransition(w.status, ['pending', 'approved', 'processing']);

    await releaseReserved(tx, db, {
      userId: w.userId,
      walletId: w.walletId,
      type: 'withdrawal_release',
      amountMinor: w.amountMinor,
      currency: w.currency,
      referenceType: 'withdrawal',
      referenceId: withdrawalId,
      description: `Withdrawal rejected — funds released`,
      createdBy: ctx.uid,
      metadata: { reason },
    });

    tx.update(ref, {
      status: 'rejected',
      rejectionReason: reason,
      reviewedBy: ctx.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await writeAuditLog({
    actorId: ctx.uid,
    action: 'withdrawal.reject',
    resourceType: 'withdrawal',
    resourceId: withdrawalId,
    metadata: { reason },
  });

  const wSnap = await db
    .collection(Collections.withdrawals)
    .doc(withdrawalId)
    .get();
  const w = wSnap.data() as WithdrawalRequest;
  await createNotification({
    userId: w.userId,
    type: 'withdrawal_rejected',
    title: 'Withdrawal rejected',
    body: reason,
    data: { withdrawalId },
  });

  log.info('withdrawal_rejected', { withdrawalId, actorId: ctx.uid });
  return { withdrawalId };
}

export const rejectWithdrawal = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleRejectWithdrawal(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});
