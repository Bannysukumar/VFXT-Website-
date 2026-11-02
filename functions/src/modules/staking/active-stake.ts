import type { Firestore } from 'firebase-admin/firestore';
import { Collections } from '../../lib/firebase';

/**
 * True when the user has at least one active staking position
 * (daily yield or locked). Required to receive affiliate / rank income.
 */
export async function userHasActiveStake(
  db: Firestore,
  userId: string,
): Promise<boolean> {
  if (!userId) return false;
  const snap = await db
    .collection(Collections.stakingPositions)
    .where('userId', '==', userId)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  return !snap.empty;
}
