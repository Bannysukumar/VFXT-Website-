import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  AdminRole,
  requireAuth,
  requireAdminRole,
} from '../../lib/permissions';
import { log } from '../../lib/logger';
import { writeAuditLog } from '../audit/handlers';
import { applyLedgerEntries } from '../wallets/ledger';
import { createNotification } from '../notifications/handlers';
import {
  BSC_CHAIN_ID,
  DEPOSIT_TTL_MS,
  USDT_BEP20_ADDRESS,
  VFXT_BEP20_ADDRESS,
  VFXT_TOKEN_DECIMALS,
} from '../../config/bsc';
import {
  findIncomingUsdtTransfer,
  getHotWalletUsdtBalance,
  inspectDepositTx,
  verifyUsdtDepositTx,
} from './bsc-usdt';

function depositTokenMeta(dep: {
  method?: string | null;
  tokenSymbol?: string | null;
  tokenAddress?: string | null;
}): { symbol: 'USDT' | 'VFXT'; address: string; decimals: number } {
  if (
    dep.method === 'vfxt_bep20' ||
    dep.tokenSymbol === 'VFXT' ||
    (typeof dep.tokenAddress === 'string' &&
      dep.tokenAddress.toLowerCase() === VFXT_BEP20_ADDRESS.toLowerCase())
  ) {
    return {
      symbol: 'VFXT',
      address: VFXT_BEP20_ADDRESS,
      decimals: VFXT_TOKEN_DECIMALS,
    };
  }
  return {
    symbol: 'USDT',
    address:
      typeof dep.tokenAddress === 'string' && dep.tokenAddress.startsWith('0x')
        ? dep.tokenAddress
        : USDT_BEP20_ADDRESS,
    decimals: 18,
  };
}
import {
  addHotWalletToPool,
  getHotWalletByAddress,
  getHotWalletPublicInfo,
  listHotWalletPool,
  pickDepositHotWallet,
  removeHotWalletFromPool,
  setHotWallet,
  updateHotWalletPoolEntry,
} from './hot-wallet';

function normalizePrivateKey(raw: string): string {
  let key = raw
    .trim()
    .replace(/^["']|["']$/g, '')
    // Strip BOM / zero-width / soft-hyphen chars MetaMask/OS paste often injects
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');
  if (key.toLowerCase().startsWith('0x')) key = key.slice(2);
  key = key.replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new AppError(
      'invalid-argument',
      `Private key must be 64 hex characters (got ${key.length} after cleanup). Do not paste a seed phrase.`,
    );
  }
  return `0x${key}`;
}

function resolvePrivateKeyPayload(data: {
  privateKey?: string;
  privateKeyB64?: string;
}): string {
  if (data.privateKeyB64 && data.privateKeyB64.trim().length > 0) {
    try {
      return Buffer.from(data.privateKeyB64.trim(), 'base64').toString('utf8');
    } catch {
      throw new AppError('invalid-argument', 'Could not decode privateKeyB64');
    }
  }
  if (data.privateKey && data.privateKey.trim().length > 0) {
    return data.privateKey;
  }
  throw new AppError(
    'invalid-argument',
    'Private key missing. Disable MetaMask on this tab (or use the 4-part fields) and try again.',
  );
}

const setSchema = z
  .object({
    privateKey: z.string().max(300).optional(),
    /** Base64 of the hex key — avoids extension scanners mangling raw hex in the DOM/body. */
    privateKeyB64: z.string().max(500).optional(),
    rpcUrl: z
      .union([z.string().url().max(300), z.literal(''), z.null()])
      .optional()
      .transform((v) => (v && typeof v === 'string' && v.length > 0 ? v : undefined)),
    autoWithdraw: z.boolean().optional(),
  })
  .refine((d) => Boolean(d.privateKey?.trim() || d.privateKeyB64?.trim()), {
    message: 'privateKey or privateKeyB64 is required',
  });

export const getCryptoWalletInfo = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAuth(request);
    const info = await getHotWalletPublicInfo();
    // Users only need deposit address when configured.
    return {
      configured: info.configured,
      depositAddress: info.address,
      network: info.network,
      token: info.token,
      tokenAddress: info.tokenAddress,
      chainId: BSC_CHAIN_ID,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const getAdminCryptoWalletInfo = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.FinanceAdmin,
      AdminRole.OperationsAdmin,
    ]);
    const info = await getHotWalletPublicInfo();
    let balanceUsdt: string | null = null;
    if (info.configured) {
      try {
        const bal = await getHotWalletUsdtBalance();
        balanceUsdt = bal.balanceUsdt;
      } catch {
        balanceUsdt = null;
      }
    }
    return { ...info, balanceUsdt, privateKeySet: info.configured };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const setCryptoHotWallet = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin]);
    const parsed = setSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      log.warn('set_crypto_hot_wallet_invalid', {
        actorId: ctx.uid,
        path: issue?.path?.join('.') ?? '',
        message: issue?.message ?? 'invalid',
        hasPrivateKey: Boolean(
          (request.data as { privateKey?: string } | undefined)?.privateKey,
        ),
        hasPrivateKeyB64: Boolean(
          (request.data as { privateKeyB64?: string } | undefined)?.privateKeyB64,
        ),
      });
      throw new AppError(
        'invalid-argument',
        issue?.message ?? 'Invalid hot wallet payload',
      );
    }
    const rawKey = resolvePrivateKeyPayload(parsed.data);
    const privateKey = normalizePrivateKey(rawKey);
    const { address } = await setHotWallet({
      privateKey,
      rpcUrl: parsed.data.rpcUrl,
      autoWithdraw: parsed.data.autoWithdraw,
      actorId: ctx.uid,
    });
    await writeAuditLog({
      actorId: ctx.uid,
      action: 'crypto.hot_wallet.set',
      resourceType: 'secrets',
      resourceId: 'cryptoHotWallet',
      metadata: { address },
    });
    log.warn('crypto_hot_wallet_updated', { actorId: ctx.uid, address });
    return { ok: true as const, address };
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function creditDepositFromChain(params: {
  depositId: string;
  txHash: string;
  from: string;
  amountMinor: number;
  userId: string;
  walletId: string;
  method?: string;
  tokenSymbol?: string | null;
  tokenAddress?: string | null;
}): Promise<void> {
  const db = getDb();
  const txRef = db.collection(Collections.usedCryptoTx).doc(params.txHash.toLowerCase());
  const depositRef = db.collection(Collections.deposits).doc(params.depositId);
  const token = depositTokenMeta(params);

  const { getTokenEconomicsSettings } = await import('../platform/store');
  const { usdCentsToVfxtTokens } = await import('../../config/plan');
  const { walletDocId } = await import('../wallets/types');
  const { ensureUserWallets } = await import('../wallets/handlers');
  await ensureUserWallets(db, params.userId);
  const tokenFx = await getTokenEconomicsSettings();
  const method =
    params.method === 'vfxt_bep20' || token.symbol === 'VFXT'
      ? 'vfxt_bep20'
      : 'usdt_bep20';
  // All deposits credit Fund Wallet in VFXT tokens only — never VFXT Wallet.
  // USDT cents → tokens at tokensPerUsd. VFXT deposits credit tokens 1:1.
  const fundTokens =
    method === 'vfxt_bep20'
      ? params.amountMinor
      : usdCentsToVfxtTokens(params.amountMinor, tokenFx.tokensPerUsd);
  if (!Number.isFinite(fundTokens) || fundTokens < 1) {
    throw new AppError(
      'failed-precondition',
      'Deposit amount too small to credit Fund Wallet',
    );
  }
  const fundWalletId = walletDocId(params.userId, 'fund');

  await db.runTransaction(async (tx) => {
    const used = await tx.get(txRef);
    if (used.exists) {
      throw new AppError('already-exists', 'Transaction already processed');
    }
    const dep = await tx.get(depositRef);
    if (!dep.exists) throw new AppError('not-found', 'Deposit not found');
    const data = dep.data()!;
    if (data.status !== 'pending' && data.status !== 'awaiting_payment') {
      throw new AppError('failed-precondition', `Deposit status is ${data.status}`);
    }

    // All wallet reads must happen before any writes in this transaction.
    await applyLedgerEntries(tx, db, [
      {
        userId: params.userId,
        walletId: fundWalletId,
        type: 'deposit_credit' as const,
        direction: 'credit' as const,
        amountMinor: fundTokens,
        availableDelta: fundTokens,
        reservedDelta: 0,
        currency: 'VFXT' as const,
        referenceType: 'deposit',
        referenceId: params.depositId,
        description: `${token.symbol} BEP-20 deposit ${params.txHash.slice(0, 10)}…`,
        createdBy: 'system:crypto-monitor',
        metadata: {
          txHash: params.txHash,
          from: params.from,
          chainId: BSC_CHAIN_ID,
          token: token.address,
          tokenSymbol: token.symbol,
          tokensPerUsd: tokenFx.tokensPerUsd,
          paidUsdtCents: method === 'usdt_bep20' ? params.amountMinor : null,
          paidVfxtTokens: method === 'vfxt_bep20' ? params.amountMinor : null,
          fundTokensCredited: fundTokens,
          // Legacy field for older clients/history.
          fundCentsCredited: fundTokens,
        },
      },
    ]);

    tx.set(txRef, {
      txHash: params.txHash.toLowerCase(),
      depositId: params.depositId,
      userId: params.userId,
      createdAt: FieldValue.serverTimestamp(),
    });

    tx.update(depositRef, {
      status: 'completed',
      method,
      walletId: fundWalletId,
      currency: 'VFXT',
      txHash: params.txHash,
      tokenSymbol: token.symbol,
      tokenAddress: token.address,
      vfxtTokensCredited: fundTokens,
      fundTokensCredited: fundTokens,
      fundCentsCredited: fundTokens,
      tokensPerUsd: tokenFx.tokensPerUsd,
      reviewedBy: 'system:crypto-monitor',
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  });

  await createNotification({
    userId: params.userId,
    type: 'deposit_completed',
    title: 'Deposit confirmed',
    body:
      method === 'vfxt_bep20'
        ? `Payment verified. ${fundTokens.toLocaleString()} VFXT credited to Fund Wallet.`
        : `Payment verified. $${(params.amountMinor / 100).toFixed(2)} USDT → ${fundTokens.toLocaleString()} VFXT credited to Fund Wallet.`,
    data: {
      depositId: params.depositId,
      txHash: params.txHash,
      fundTokens,
      fundCents: fundTokens,
      token: token.symbol,
    },
  });
}

export const checkDepositPayment = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const body = (request.data ?? {}) as { depositId?: string; txHash?: string };
    const depositId = z.string().min(1).parse(body.depositId);
    const clientTxHash = body.txHash
      ? z
          .string()
          .regex(/^0x[0-9a-fA-F]{64}$/)
          .parse(body.txHash)
      : undefined;
    const db = getDb();
    const snap = await db.collection(Collections.deposits).doc(depositId).get();
    if (!snap.exists) throw new AppError('not-found', 'Deposit not found');
    const dep = snap.data()!;
    if (dep.userId !== ctx.uid) {
      throw new AppError('permission-denied', 'Not your deposit');
    }

    if (dep.status === 'completed' || dep.status === 'approved') {
      return {
        status: 'completed' as const,
        txHash: (dep.txHash as string) ?? null,
        depositId,
      };
    }
    if (dep.status === 'pending' && dep.manualReview) {
      return {
        status: 'pending' as const,
        txHash: (dep.txHash as string) ?? null,
        depositId,
        manualReview: true,
        suggestedCreditMinor:
          dep.suggestedCreditMinor != null ? Number(dep.suggestedCreditMinor) : null,
        observedAmountDisplay:
          typeof dep.observedAmountDisplay === 'string' ? dep.observedAmountDisplay : null,
      };
    }
    if (dep.status === 'rejected' || dep.status === 'cancelled' || dep.status === 'expired') {
      return { status: dep.status as string, txHash: null, depositId };
    }

    const savedDepositAddress =
      typeof dep.depositAddress === 'string' && dep.depositAddress.startsWith('0x')
        ? dep.depositAddress
        : null;
    const bound = savedDepositAddress
      ? await getHotWalletByAddress(savedDepositAddress)
      : null;
    const hot = bound ?? (await pickDepositHotWallet());
    const receiveAddress = savedDepositAddress || hot.address;
    const {
      depositWeiCandidatesForCredit,
      normalizeDepositAmountIfSole,
      resolveDepositExpectedWei,
    } = await import('./unique-amount');
    // If peers finished and this is the only open deposit for this amount,
    // clear unique decimals so the user can pay the usual round amount.
    const normalized = await normalizeDepositAmountIfSole(db, depositId, {
      ...dep,
      depositAddress: receiveAddress,
    });
    const depForMatch = {
      ...dep,
      expectedWei: normalized.expectedWei,
      paymentTag: normalized.paymentTag,
      depositAddress: receiveAddress,
      previousExpectedWei: normalized.previousExpectedWei,
    };
    const expectedWei = resolveDepositExpectedWei(depForMatch);
    const acceptedWeis = await depositWeiCandidatesForCredit(db, depositId, depForMatch);
    const createdAt = dep.createdAt?.toMillis?.() ?? Date.now() - DEPOSIT_TTL_MS;
    const expiresAtMs =
      dep.expiresAt?.toMillis?.() ?? createdAt + DEPOSIT_TTL_MS;
    if (Date.now() > expiresAtMs) {
      await snap.ref.update({
        status: 'expired',
        rejectionReason: 'Payment window expired — create a new deposit',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return {
        status: 'expired' as const,
        txHash: null,
        depositId,
        expiresAtMs,
      };
    }

    const isTxUsed = async (txHash: string) => {
      const used = await db
        .collection(Collections.usedCryptoTx)
        .doc(txHash.toLowerCase())
        .get();
      return used.exists;
    };

    // If this deposit already owns the pasted tx, treat as completed.
    if (clientTxHash) {
      const usedSnap = await db
        .collection(Collections.usedCryptoTx)
        .doc(clientTxHash.toLowerCase())
        .get();
      if (usedSnap.exists) {
        const usedDepId = usedSnap.data()?.depositId;
        if (usedDepId === depositId) {
          if (dep.status !== 'completed' && dep.status !== 'approved') {
            await snap.ref.update({
              status: 'completed',
              txHash: clientTxHash,
              updatedAt: FieldValue.serverTimestamp(),
            });
          }
          return {
            status: 'completed' as const,
            txHash: clientTxHash,
            depositId,
            fundCentsCredited: Number(dep.fundCentsCredited ?? 0) || null,
          };
        }
        throw new AppError(
          'already-exists',
          'This transaction was already used for another deposit',
        );
      }
    }

    const token = depositTokenMeta(dep);

    const queueManualReview = async (input: {
      reason: string;
      txHash: string;
      observedWei?: string | null;
      observedDisplay?: string | null;
      observedUsdCents?: number | null;
      from?: string | null;
      suggestedCreditMinor?: number | null;
    }) => {
      const txRef = db.collection(Collections.usedCryptoTx).doc(input.txHash.toLowerCase());
      const usedSnap = await txRef.get();
      if (usedSnap.exists && usedSnap.data()?.depositId !== depositId) {
        throw new AppError(
          'already-exists',
          'This transaction was already used for another deposit',
        );
      }

      const isVfxt = token.symbol === 'VFXT';
      let suggested =
        input.suggestedCreditMinor != null && Number.isFinite(input.suggestedCreditMinor)
          ? Math.max(0, Math.floor(Number(input.suggestedCreditMinor)))
          : null;
      if (suggested == null && input.observedWei) {
        try {
          const wei = BigInt(input.observedWei);
          suggested = isVfxt
            ? Number(wei / 10n ** BigInt(token.decimals))
            : Number(wei / 10n ** 16n); // USDT cents
        } catch {
          suggested = null;
        }
      }

      await snap.ref.update({
        status: 'pending',
        manualReview: true,
        manualReviewReason: input.reason.slice(0, 1000),
        txHash: input.txHash,
        observedWei: input.observedWei ?? null,
        observedAmountDisplay: input.observedDisplay ?? null,
        observedUsdCents: input.observedUsdCents ?? null,
        observedFrom: input.from ?? null,
        suggestedCreditMinor: suggested,
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (!usedSnap.exists) {
        await txRef.set({
          txHash: input.txHash.toLowerCase(),
          depositId,
          userId: ctx.uid,
          pendingManualReview: true,
          createdAt: FieldValue.serverTimestamp(),
        });
      }

      await createNotification({
        userId: ctx.uid,
        type: 'deposit_pending_review',
        title: 'Deposit sent for review',
        body: 'We could not auto-match your payment. An admin will review and credit the correct amount.',
        data: { depositId, txHash: input.txHash },
      });

      log.info('deposit_queued_manual_review', {
        depositId,
        txHash: input.txHash,
        reason: input.reason.slice(0, 200),
        suggestedCreditMinor: suggested,
      });

      return {
        status: 'pending' as const,
        txHash: input.txHash,
        depositId,
        manualReview: true,
        suggestedCreditMinor: suggested,
        observedAmountDisplay: input.observedDisplay ?? null,
      };
    };

    let found;
    try {
      if (clientTxHash) {
        found = await verifyUsdtDepositTx({
          txHash: clientTxHash,
          expectedWei,
          acceptedWeis,
          notBeforeMs: createdAt - 60_000,
          isTxUsed,
          toAddress: receiveAddress,
          tokenAddress: token.address,
          tokenSymbol: token.symbol,
          tokenDecimals: token.decimals,
        });
      } else {
        found = await findIncomingUsdtTransfer({
          expectedWei,
          acceptedWeis,
          notBeforeMs: createdAt - 60_000,
          isTxUsed,
          toAddress: receiveAddress,
          tokenAddress: token.address,
        });
      }
    } catch (scanErr) {
      if (clientTxHash && scanErr instanceof AppError) {
        const msg = scanErr.message || '';
        // Still confirming on-chain — keep waiting, don't escalate yet.
        if (/Waiting for confirmations/i.test(msg)) {
          throw scanErr;
        }

        const details = (scanErr.details ?? {}) as {
          observedWei?: string;
          observedDisplay?: string;
          amountUsdCents?: number;
          from?: string;
        };

        let observedWei = details.observedWei ?? null;
        let observedDisplay = details.observedDisplay ?? null;
        let observedUsdCents = details.amountUsdCents ?? null;
        let from = details.from ?? null;

        if (!observedWei) {
          try {
            const inspected = await inspectDepositTx({
              txHash: clientTxHash,
              notBeforeMs: createdAt - 60_000,
              requireConfirmations: false,
              toAddress: receiveAddress,
              tokenAddress: token.address,
              tokenSymbol: token.symbol,
              tokenDecimals: token.decimals,
            });
            observedWei = inspected.amountWei.toString();
            observedDisplay = inspected.amountDisplay ?? null;
            observedUsdCents = inspected.amountUsdCents;
            from = inspected.from;
          } catch {
            /* keep reason-only manual review */
          }
        }

        return queueManualReview({
          reason: msg,
          txHash: clientTxHash,
          observedWei,
          observedDisplay,
          observedUsdCents,
          from,
        });
      }
      // Public RPCs rate-limit eth_getLogs — keep the deposit open instead of 500.
      log.warn('check_deposit_scan_deferred', {
        depositId,
        error: scanErr instanceof Error ? scanErr.message : String(scanErr),
      });
      return {
        status: 'awaiting_payment' as const,
        txHash: null,
        depositId,
        depositAddress: receiveAddress,
        amountUsdt: normalized.amountDisplay,
        expectedWei: normalized.expectedWei,
        paymentTag: normalized.paymentTag,
        amountNormalized: normalized.normalized,
      };
    }

    if (!found) {
      if (clientTxHash) {
        try {
          const inspected = await inspectDepositTx({
            txHash: clientTxHash,
            notBeforeMs: createdAt - 60_000,
            requireConfirmations: false,
            toAddress: receiveAddress,
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            tokenDecimals: token.decimals,
          });
          return queueManualReview({
            reason: 'Automatic match failed — queued for admin review',
            txHash: clientTxHash,
            observedWei: inspected.amountWei.toString(),
            observedDisplay: inspected.amountDisplay ?? null,
            observedUsdCents: inspected.amountUsdCents,
            from: inspected.from,
          });
        } catch (inspectErr) {
          return queueManualReview({
            reason:
              inspectErr instanceof Error
                ? inspectErr.message
                : 'Could not verify transaction automatically',
            txHash: clientTxHash,
          });
        }
      }
      return {
        status: 'awaiting_payment' as const,
        txHash: null,
        depositId,
        depositAddress: receiveAddress,
        amountUsdt: normalized.amountDisplay,
        expectedWei: normalized.expectedWei,
        paymentTag: normalized.paymentTag,
        amountNormalized: normalized.normalized,
      };
    }

    try {
      await creditDepositFromChain({
        depositId,
        txHash: found.txHash,
        from: found.from,
        amountMinor: Number(dep.amountMinor),
        userId: dep.userId,
        walletId: dep.walletId,
        method: String(dep.method || ''),
        tokenSymbol: token.symbol,
        tokenAddress: token.address,
      });
    } catch (creditErr) {
      // Concurrent check/monitor may have credited already — treat as success.
      if (creditErr instanceof AppError && creditErr.code === 'already-exists') {
        const fresh = await snap.ref.get();
        const st = fresh.data()?.status;
        if (st === 'completed' || st === 'approved') {
          return {
            status: 'completed' as const,
            txHash: (fresh.data()?.txHash as string) ?? found.txHash,
            depositId,
            fundCentsCredited: Number(fresh.data()?.fundCentsCredited ?? 0) || null,
          };
        }
      }
      throw creditErr;
    }

    const fresh = await snap.ref.get();
    return {
      status: 'completed' as const,
      txHash: found.txHash,
      depositId,
      fundCentsCredited: Number(fresh.data()?.fundCentsCredited ?? 0) || null,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Poll pending crypto deposits every 2 minutes. */
export const monitorCryptoDeposits = onSchedule(
  {
    schedule: 'every 2 minutes',
    region: 'us-central1',
    timeoutSeconds: 300,
  },
  async () => {
    const db = getDb();
    let pending;
    try {
      const [usdtSnap, vfxtSnap] = await Promise.all([
        db
          .collection(Collections.deposits)
          .where('method', '==', 'usdt_bep20')
          .where('status', 'in', ['pending', 'awaiting_payment'])
          .limit(40)
          .get(),
        db
          .collection(Collections.deposits)
          .where('method', '==', 'vfxt_bep20')
          .where('status', 'in', ['pending', 'awaiting_payment'])
          .limit(40)
          .get(),
      ]);
      pending = { docs: [...usdtSnap.docs, ...vfxtSnap.docs] };
    } catch (err) {
      log.warn('monitor_deposits_query_failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    const {
      depositWeiCandidatesForCredit,
      normalizeDepositAmountIfSole,
      resolveDepositExpectedWei,
    } = await import('./unique-amount');
    const ordered = [...pending.docs].sort((a, b) => {
      const am = a.data().createdAt?.toMillis?.() ?? 0;
      const bm = b.data().createdAt?.toMillis?.() ?? 0;
      return am - bm;
    });

    for (const doc of ordered) {
      const dep = doc.data();
      const createdAt = dep.createdAt?.toMillis?.() ?? Date.now();
      const expiresAtMs =
        dep.expiresAt?.toMillis?.() ?? createdAt + DEPOSIT_TTL_MS;
      if (Date.now() > expiresAtMs) {
        await doc.ref.update({
          status: 'expired',
          rejectionReason: 'Payment window expired — create a new deposit',
          updatedAt: FieldValue.serverTimestamp(),
        });
        continue;
      }
      try {
        const normalized = await normalizeDepositAmountIfSole(db, doc.id, dep);
        const depForMatch = {
          ...dep,
          expectedWei: normalized.expectedWei,
          paymentTag: normalized.paymentTag,
          previousExpectedWei: normalized.previousExpectedWei,
        };
        const expectedWei = resolveDepositExpectedWei(depForMatch);
        const acceptedWeis = await depositWeiCandidatesForCredit(db, doc.id, depForMatch);
        const token = depositTokenMeta(dep);
        const found = await findIncomingUsdtTransfer({
          expectedWei,
          acceptedWeis,
          notBeforeMs: createdAt - 60_000,
          toAddress: (dep.depositAddress as string) || undefined,
          tokenAddress: token.address,
          isTxUsed: async (txHash) => {
            const used = await db
              .collection(Collections.usedCryptoTx)
              .doc(txHash.toLowerCase())
              .get();
            return used.exists;
          },
        });
        if (!found) continue;
        try {
          await creditDepositFromChain({
            depositId: doc.id,
            txHash: found.txHash,
            from: found.from,
            amountMinor: Number(dep.amountMinor),
            userId: dep.userId,
            walletId: dep.walletId,
            method: String(dep.method || ''),
            tokenSymbol: token.symbol,
            tokenAddress: token.address,
          });
        } catch (creditErr) {
          if (creditErr instanceof AppError && creditErr.code === 'already-exists') {
            continue;
          }
          throw creditErr;
        }
        log.info('deposit_auto_credited', {
          depositId: doc.id,
          txHash: found.txHash,
          expectedWei: expectedWei.toString(),
          token: token.symbol,
        });
      } catch (err) {
        log.warn('deposit_monitor_item_failed', {
          depositId: doc.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  },
);

export const listCryptoHotWallets = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [AdminRole.SuperAdmin, AdminRole.FinanceAdmin]);
    const info = await getHotWalletPublicInfo();
    const pool = await listHotWalletPool();
    return {
      ...info,
      pool: pool.map((w) => ({
        id: w.id,
        label: w.label,
        address: w.address,
        rpcUrl: w.rpcUrl,
        enabled: w.enabled,
        useForDeposits: w.useForDeposits,
        useForWithdrawals: w.useForWithdrawals,
      })),
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const addCryptoHotWallet = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin]);
    const body = (request.data ?? {}) as {
      privateKey?: string;
      privateKeyB64?: string;
      label?: string;
      rpcUrl?: string;
    };
    const rawKey = resolvePrivateKeyPayload(body);
    const privateKey = normalizePrivateKey(rawKey);
    const result = await addHotWalletToPool({
      privateKey,
      label: body.label,
      rpcUrl: body.rpcUrl,
      actorId: ctx.uid,
    });
    await writeAuditLog({
      actorId: ctx.uid,
      action: 'crypto.hot_wallet_pool.add',
      resourceType: 'secrets',
      resourceId: result.id,
      metadata: { address: result.address },
    });
    return { ok: true as const, ...result };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const updateCryptoHotWallet = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin]);
    const body = z
      .object({
        id: z.string().min(1),
        enabled: z.boolean().optional(),
        label: z.string().max(80).optional(),
        rpcUrl: z.string().url().max(300).optional(),
        useForDeposits: z.boolean().optional(),
        useForWithdrawals: z.boolean().optional(),
      })
      .parse(request.data ?? {});
    await updateHotWalletPoolEntry({ ...body, actorId: ctx.uid });
    return { ok: true as const };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const removeCryptoHotWallet = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin]);
    const id = z.string().min(1).parse((request.data as { id?: string })?.id);
    await removeHotWalletFromPool({ id, actorId: ctx.uid });
    await writeAuditLog({
      actorId: ctx.uid,
      action: 'crypto.hot_wallet_pool.remove',
      resourceType: 'secrets',
      resourceId: id,
      metadata: {},
    });
    return { ok: true as const };
  } catch (err) {
    throw toHttpsError(err);
  }
});
