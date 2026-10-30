import {
  FieldValue,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { flushIdempotencyClaims } from '../../lib/idempotency';
import { addMinor, assertPositiveMinor } from '../../lib/money';
import { LedgerEntry, WalletDoc } from '../../types/models';
import { AppendLedgerParams } from './types';

type WalletMutation = AppendLedgerParams;

function validateWallet(
  wallet: WalletDoc,
  params: Pick<AppendLedgerParams, 'userId' | 'currency' | 'walletId'>,
): void {
  if (wallet.userId !== params.userId) {
    throw new AppError('permission-denied', 'Wallet does not belong to user');
  }
  if (wallet.currency !== params.currency) {
    throw new AppError('invalid-argument', 'Currency mismatch');
  }
  if (
    !Number.isInteger(wallet.availableMinor) ||
    !Number.isInteger(wallet.reservedMinor)
  ) {
    throw new AppError(
      'failed-precondition',
      'Wallet balances corrupted (non-integer)',
    );
  }
}

/**
 * Apply one or more ledger mutations in a transaction.
 * Reads every distinct wallet first, then flushes deferred idempotency
 * claims, then writes — satisfying Firestore read-before-write rules.
 */
export async function applyLedgerEntries(
  tx: Transaction,
  db: Firestore,
  mutations: WalletMutation[],
): Promise<Array<{ entryId: string; wallet: WalletDoc }>> {
  if (mutations.length === 0) return [];

  const walletIds = [...new Set(mutations.map((m) => m.walletId))];
  const walletRefs = walletIds.map((id) =>
    db.collection(Collections.wallets).doc(id),
  );
  const snaps = await Promise.all(walletRefs.map((ref) => tx.get(ref)));

  const state = new Map<string, WalletDoc>();
  for (let i = 0; i < walletIds.length; i += 1) {
    const id = walletIds[i]!;
    const snap = snaps[i]!;
    if (!snap.exists) {
      throw new AppError('not-found', `Wallet ${id} not found`);
    }
    state.set(id, snap.data() as WalletDoc);
  }

  // All reads done — flush deferred idempotency writes, then ledger writes.
  flushIdempotencyClaims(tx);

  const results: Array<{ entryId: string; wallet: WalletDoc }> = [];

  for (const params of mutations) {
    assertPositiveMinor(params.amountMinor);
    const wallet = state.get(params.walletId);
    if (!wallet) {
      throw new AppError('not-found', `Wallet ${params.walletId} not found`);
    }
    validateWallet(wallet, params);

    const nextAvailable = addMinor(wallet.availableMinor, params.availableDelta);
    const nextReserved = addMinor(wallet.reservedMinor, params.reservedDelta);

    if (nextAvailable < 0 || nextReserved < 0) {
      throw new AppError('insufficient-balance', 'Insufficient balance', {
        availableMinor: wallet.availableMinor,
        reservedMinor: wallet.reservedMinor,
        availableDelta: params.availableDelta,
        reservedDelta: params.reservedDelta,
      });
    }

    const entryId = uuidv4();
    const entry: LedgerEntry = {
      entryId,
      userId: params.userId,
      walletId: params.walletId,
      type: params.type,
      direction: params.direction,
      amountMinor: params.amountMinor,
      balanceAfterAvailableMinor: nextAvailable,
      balanceAfterReservedMinor: nextReserved,
      currency: params.currency,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      description: params.description,
      metadata: params.metadata ?? {},
      createdAt: FieldValue.serverTimestamp(),
      createdBy: params.createdBy,
    };

    const updated: WalletDoc = {
      ...wallet,
      availableMinor: nextAvailable,
      reservedMinor: nextReserved,
    };
    state.set(params.walletId, updated);

    tx.set(db.collection(Collections.ledger).doc(entryId), entry);
    tx.update(db.collection(Collections.wallets).doc(params.walletId), {
      availableMinor: nextAvailable,
      reservedMinor: nextReserved,
      updatedAt: FieldValue.serverTimestamp(),
    });

    results.push({ entryId, wallet: updated });
  }

  return results;
}

/**
 * Append a ledger entry and update wallet balances inside an existing
 * Firestore transaction. NEVER call outside a transaction for financial ops.
 */
export async function appendLedgerEntry(
  tx: Transaction,
  db: Firestore,
  params: AppendLedgerParams,
): Promise<{ entryId: string; wallet: WalletDoc }> {
  const [result] = await applyLedgerEntries(tx, db, [params]);
  return result!;
}

/** Credit available balance (deposit approve, bonus, etc.). */
export async function creditAvailable(
  tx: Transaction,
  db: Firestore,
  params: Omit<AppendLedgerParams, 'direction' | 'availableDelta' | 'reservedDelta'>,
): Promise<{ entryId: string; wallet: WalletDoc }> {
  return appendLedgerEntry(tx, db, {
    ...params,
    direction: 'credit',
    availableDelta: params.amountMinor,
    reservedDelta: 0,
  });
}

/** Debit available balance (stake, transfers, etc.). */
export async function debitAvailable(
  tx: Transaction,
  db: Firestore,
  params: Omit<AppendLedgerParams, 'direction' | 'availableDelta' | 'reservedDelta'>,
): Promise<{ entryId: string; wallet: WalletDoc }> {
  return appendLedgerEntry(tx, db, {
    ...params,
    direction: 'debit',
    availableDelta: -params.amountMinor,
    reservedDelta: 0,
  });
}

/**
 * Reserve funds for a pending withdrawal:
 * available -= amount, reserved += amount.
 */
export async function reserveFunds(
  tx: Transaction,
  db: Firestore,
  params: Omit<AppendLedgerParams, 'direction' | 'availableDelta' | 'reservedDelta'>,
): Promise<{ entryId: string; wallet: WalletDoc }> {
  return appendLedgerEntry(tx, db, {
    ...params,
    direction: 'debit',
    availableDelta: -params.amountMinor,
    reservedDelta: params.amountMinor,
  });
}

/**
 * Complete a withdrawal: reserved -= amount (funds leave the platform).
 */
export async function debitReserved(
  tx: Transaction,
  db: Firestore,
  params: Omit<AppendLedgerParams, 'direction' | 'availableDelta' | 'reservedDelta'>,
): Promise<{ entryId: string; wallet: WalletDoc }> {
  return appendLedgerEntry(tx, db, {
    ...params,
    direction: 'debit',
    availableDelta: 0,
    reservedDelta: -params.amountMinor,
  });
}

/**
 * Release a reservation (reject/cancel withdrawal):
 * reserved -= amount, available += amount.
 */
export async function releaseReserved(
  tx: Transaction,
  db: Firestore,
  params: Omit<AppendLedgerParams, 'direction' | 'availableDelta' | 'reservedDelta'>,
): Promise<{ entryId: string; wallet: WalletDoc }> {
  return appendLedgerEntry(tx, db, {
    ...params,
    direction: 'credit',
    availableDelta: params.amountMinor,
    reservedDelta: -params.amountMinor,
  });
}
