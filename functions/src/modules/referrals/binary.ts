import { FieldValue, Firestore, Transaction } from 'firebase-admin/firestore';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { BinarySide, UserProfile } from '../../types/models';

/**
 * Place referee under sponsor in the binary tree.
 * First direct → left if empty, else right if empty, else spillover
 * recursively to the weaker leg (lower volume; left on tie).
 */
export async function placeInBinaryTree(
  tx: Transaction,
  db: Firestore,
  sponsorId: string,
  refereeId: string,
): Promise<{ parentId: string; side: BinarySide }> {
  let cursorId = sponsorId;
  const visited = new Set<string>();
  let guard = 0;

  while (guard < 64) {
    guard += 1;
    if (visited.has(cursorId)) {
      throw new AppError('failed-precondition', 'Binary cycle detected');
    }
    visited.add(cursorId);

    const parentRef = db.collection(Collections.users).doc(cursorId);
    const parentSnap = await tx.get(parentRef);
    if (!parentSnap.exists) {
      throw new AppError('not-found', 'Binary parent not found');
    }
    const parent = parentSnap.data() as UserProfile;

    if (!parent.binaryLeftId) {
      tx.update(parentRef, {
        binaryLeftId: refereeId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { parentId: cursorId, side: 'left' };
    }

    if (!parent.binaryRightId) {
      tx.update(parentRef, {
        binaryRightId: refereeId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { parentId: cursorId, side: 'right' };
    }

    // Spillover to weaker leg.
    const leftVol = parent.leftVolumeMinor ?? 0;
    const rightVol = parent.rightVolumeMinor ?? 0;
    cursorId =
      leftVol <= rightVol
        ? (parent.binaryLeftId as string)
        : (parent.binaryRightId as string);
  }

  throw new AppError('failed-precondition', 'Binary placement depth exceeded');
}
