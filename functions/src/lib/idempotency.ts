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

/**
 * Claim an idempotency key inside an existing transaction.
 * If the key already exists, throws AppError('idempotency-conflict')
 * unless `onConflict` returns a replay result.
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

  tx.set(ref, {
    key,
    operation,
    actorId,
    resultRef: resultRef ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });

  return 'claimed';
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
