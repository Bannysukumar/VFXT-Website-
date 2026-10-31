import type { Firestore } from 'firebase-admin/firestore';
import { Collections } from './firebase';
import { AppError } from './errors';

const COUNTER_DOC = 'userIdCounter';
/** First allocated id is VFXT2500 (matches product examples like VFXT2533). */
const START_AT = 2500;
const MAX_ATTEMPTS = 25;

/**
 * Allocate a short unique public user id: VFXT2500, VFXT2501, …
 * Used as referral code and for P2P transfers.
 */
export async function allocateUniqueUserId(db: Firestore): Promise<string> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const code = await db.runTransaction(async (tx) => {
      const ref = db.collection(Collections.config).doc(COUNTER_DOC);
      const snap = await tx.get(ref);
      const next = snap.exists
        ? Number((snap.data() as { next?: number })?.next ?? START_AT)
        : START_AT;
      if (!Number.isFinite(next) || next < START_AT) {
        throw new AppError('internal', 'User id counter is corrupted');
      }
      const candidate = `VFXT${next}`;
      tx.set(ref, { next: next + 1, updatedAt: new Date().toISOString() }, { merge: true });
      return candidate;
    });

    const clash = await db
      .collection(Collections.users)
      .where('referralCode', '==', code)
      .limit(1)
      .get();
    if (clash.empty) return code;
  }

  throw new AppError('resource-exhausted', 'Could not allocate a unique user id');
}

/** Normalize user-entered id / referral code (trim + uppercase). */
export function normalizeUserId(raw: string): string {
  return raw.trim().toUpperCase();
}
