import {
  FieldValue,
  Firestore,
  Transaction,
} from 'firebase-admin/firestore';
import { Collections } from './firebase';
import { AppError } from './errors';

export interface IdempotencyRecord {
  key: string;
  operation: string;
  actorId: string;
  resultRef?: string;
  createdAt: FirebaseFirestore.Timestamp | FieldValue;
}

type PendingClaim = {
  ref: FirebaseFirestore.DocumentReference;
  data: Record<string, unknown>;
};

const pendingClaims = new WeakMap<Transaction, PendingClaim[]>();

/**
 * Claim an idempotency key inside an existing transaction.
 *
 * Only performs a READ here. The write is deferred until
 * `flushIdempotencyClaims(tx)` so callers can still read wallets
 * afterward (Firestore requires all reads before all writes).
 */
export async function claimIdempotencyKey(
  tx: Transaction,
  db: Firestore,
  key: string,
  operation: string,
  actorId: string,
  resultRef?: string,
): Promise<'claimed'> {
  const ref = db.collection(Collections.idempotencyKeys).doc(key);
  const snap = await tx.get(ref);

  if (snap.exists) {
    const existing = snap.data() as IdempotencyRecord;
    throw new AppError(
      'idempotency-conflict',
      `Idempotency key already used for ${existing.operation}`,
      { key, existingResultRef: existing.resultRef },
    );
  }

  const list = pendingClaims.get(tx) ?? [];
  list.push({
    ref,
    data: {
      key,
      operation,
      actorId,
      resultRef: resultRef ?? null,
      createdAt: FieldValue.serverTimestamp(),
    },
  });
  pendingClaims.set(tx, list);

  return 'claimed';
}

/** Flush deferred idempotency writes. Safe to call multiple times. */
export function flushIdempotencyClaims(tx: Transaction): void {
  const list = pendingClaims.get(tx);
  if (!list?.length) return;
  for (const item of list) {
    tx.set(item.ref, item.data);
  }
  pendingClaims.delete(tx);
}

/**
 * Read an existing idempotency record (outside a transaction).
 */
export async function getIdempotencyRecord(
  db: Firestore,
  key: string,
): Promise<IdempotencyRecord | null> {
  const snap = await db.collection(Collections.idempotencyKeys).doc(key).get();
  if (!snap.exists) return null;
  return snap.data() as IdempotencyRecord;
}

/** Build a deterministic key for common financial ops. */
export function buildIdempotencyKey(
  operation: string,
  resourceId: string,
  actorId: string,
): string {
  return `${operation}:${resourceId}:${actorId}`;
}
