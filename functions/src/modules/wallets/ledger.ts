import {
  FieldValue,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { addMinor, assertPositiveMinor } from '../../lib/money';
import { LedgerEntry, WalletDoc } from '../../types/models';
import { AppendLedgerParams } from './types';

/**
 * Append a ledger entry and update wallet balances inside an existing
 * Firestore transaction. NEVER call outside a transaction for financial ops.
 */
export async function appendLedgerEntry(
  tx: Transaction,
  db: Firestore,
  params: AppendLedgerParams,
): Promise<{ entryId: string; wallet: WalletDoc }> {
  assertPositiveMinor(params.amountMinor);

  const walletRef = db.collection(Collections.wallets).doc(params.walletId);
  const walletSnap = await tx.get(walletRef);
  if (!walletSnap.exists) {
    throw new AppError('not-found', `Wallet ${params.walletId} not found`);
  }

  const wallet = walletSnap.data() as WalletDoc;
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

  const entryRef = db.collection(Collections.ledger).doc(entryId);
  tx.set(entryRef, entry);
  tx.update(walletRef, {
    availableMinor: nextAvailable,
    reservedMinor: nextReserved,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    entryId,
    wallet: {
      ...wallet,
      availableMinor: nextAvailable,
      reservedMinor: nextReserved,
    },
  };
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
