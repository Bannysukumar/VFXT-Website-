import type { Firestore } from 'firebase-admin/firestore';
import { Collections } from '../../lib/firebase';

export function normalizeWalletAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

/**
 * A wallet is claimed if any user has it as walletAddress / withdrawalAddress,
 * or any withdrawal already used it as destination (by another user when excludeUid set).
 */
export async function findWalletClaim(
  db: Firestore,
  address: string,
  excludeUid?: string,
): Promise<{ kind: 'profile' | 'withdrawal'; uid: string } | null> {
  const normalized = normalizeWalletAddress(address);

  const byWallet = await db
    .collection(Collections.users)
    .where('walletAddress', '==', normalized)
    .limit(1)
    .get();
  if (!byWallet.empty) {
    const uid = byWallet.docs[0]!.id;
    if (!excludeUid || uid !== excludeUid) {
      return { kind: 'profile', uid };
    }
  }

  const byWithdrawAddr = await db
    .collection(Collections.users)
    .where('withdrawalAddress', '==', normalized)
    .limit(1)
    .get();
  if (!byWithdrawAddr.empty) {
    const uid = byWithdrawAddr.docs[0]!.id;
    if (!excludeUid || uid !== excludeUid) {
      return { kind: 'profile', uid };
    }
  }

  const byWithdrawal = await db
    .collection(Collections.withdrawals)
    .where('destination', '==', normalized)
    .limit(5)
    .get();
  for (const doc of byWithdrawal.docs) {
    const uid = String(doc.data().userId ?? '');
    if (!uid) continue;
    if (excludeUid && uid === excludeUid) continue;
    return { kind: 'withdrawal', uid };
  }

  return null;
}
