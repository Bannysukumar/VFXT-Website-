import { formatUnits } from 'ethers';
import type { Firestore } from 'firebase-admin/firestore';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  USDT_DECIMALS,
  VFXT_TOKEN_DECIMALS,
  usdCentsToUsdtWei,
} from '../../config/bsc';

/** Max concurrent same-amount open deposits we can disambiguate. */
const MAX_PAYMENT_TAG = 999_999;

export type DepositAsset = 'USDT' | 'VFXT';

/**
 * USDT: amountMinor = USD cents → USDT wei (1:1).
 * VFXT: amountMinor = whole tokens → VFXT wei (18 decimals). Enter 100 → send ~100 VFXT.
 */
function baseWeiForAsset(amountMinor: number, asset: DepositAsset): bigint {
  if (asset === 'VFXT') {
    if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
      throw new AppError('invalid-argument', 'VFXT amount must be a positive whole token count');
    }
    return BigInt(amountMinor) * 10n ** BigInt(VFXT_TOKEN_DECIMALS);
  }
  return usdCentsToUsdtWei(amountMinor);
}

/**
 * Each open deposit gets a unique on-chain wei amount:
 *   baseWei(amountMinor, asset) + paymentTag
 * so concurrent same-amount deposits don't collide on one hot wallet.
 */
export async function allocateUniqueDepositWei(
  db: Firestore,
  amountMinor: number,
  options?: { asset?: DepositAsset },
): Promise<{ expectedWei: string; amountDisplay: string; paymentTag: number }> {
  const asset: DepositAsset = options?.asset ?? 'USDT';
  const decimals = asset === 'VFXT' ? VFXT_TOKEN_DECIMALS : USDT_DECIMALS;
  const base = baseWeiForAsset(amountMinor, asset);
  const method = asset === 'VFXT' ? 'vfxt_bep20' : 'usdt_bep20';

  const open = await db
    .collection(Collections.deposits)
    .where('status', 'in', ['pending', 'awaiting_payment'])
    .limit(200)
    .get();

  const usedTags = new Set<number>();
  for (const doc of open.docs) {
    const data = doc.data();
    if (Number(data.amountMinor) !== amountMinor) continue;
    const docMethod = String(data.method || '');
    if (docMethod && docMethod !== method && docMethod !== 'manual') continue;
    if (data.tokenSymbol && data.tokenSymbol !== asset) continue;
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
      amountDisplay: formatUnits(wei, decimals),
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
  method?: string | null;
  tokenSymbol?: string | null;
}): bigint {
  if (dep.expectedWei) {
    return BigInt(String(dep.expectedWei));
  }
  const asset: DepositAsset =
    dep.method === 'vfxt_bep20' || dep.tokenSymbol === 'VFXT' ? 'VFXT' : 'USDT';
  return baseWeiForAsset(Number(dep.amountMinor), asset);
}
