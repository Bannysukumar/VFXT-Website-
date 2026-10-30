import { formatUnits } from 'ethers';
import type { Firestore } from 'firebase-admin/firestore';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { USDT_DECIMALS, usdCentsToUsdtWei } from '../../config/bsc';

/** Max concurrent same-dollar open deposits we can disambiguate. */
const MAX_PAYMENT_TAG = 999_999;

/**
 * Each open deposit gets a unique on-chain USDT wei amount:
 *   baseWei(amountMinor) + paymentTag
 * so 4 users depositing "$100" each send a slightly different exact amount
 * (e.g. 100.000000000000001234) and only their matching transfer credits them.
 * Ledger still credits the requested amountMinor (full dollars/cents).
 */
export async function allocateUniqueDepositWei(
  db: Firestore,
  amountMinor: number,
): Promise<{ expectedWei: string; amountUsdt: string; paymentTag: number }> {
  const base = usdCentsToUsdtWei(amountMinor);

  const open = await db
    .collection(Collections.deposits)
    .where('status', 'in', ['pending', 'awaiting_payment'])
    .limit(200)
    .get();

  const usedTags = new Set<number>();
  for (const doc of open.docs) {
    const data = doc.data();
    if (Number(data.amountMinor) !== amountMinor) continue;
    if (!data.expectedWei) {
      usedTags.add(0);
      continue;
    }
    try {
      const tag = Number(BigInt(String(data.expectedWei)) - base);
      if (Number.isInteger(tag) && tag >= 0 && tag <= MAX_PAYMENT_TAG) {
        usedTags.add(tag);
      }
    } catch {
      /* ignore malformed */
    }
  }

  const start = (Date.now() % MAX_PAYMENT_TAG) + 1;
  for (let i = 0; i < MAX_PAYMENT_TAG; i++) {
    const tag = ((start + i - 1) % MAX_PAYMENT_TAG) + 1;
    if (usedTags.has(tag)) continue;
    const wei = base + BigInt(tag);
    return {
      expectedWei: wei.toString(),
      amountUsdt: formatUnits(wei, USDT_DECIMALS),
      paymentTag: tag,
    };
  }

  throw new AppError(
    'resource-exhausted',
    'Too many open deposits for this amount. Try again shortly or pick a different amount.',
  );
}

export function resolveDepositExpectedWei(dep: {
  expectedWei?: string | null;
  amountMinor?: number;
}): bigint {
  if (dep.expectedWei) {
    return BigInt(String(dep.expectedWei));
  }
  return usdCentsToUsdtWei(Number(dep.amountMinor));
}
