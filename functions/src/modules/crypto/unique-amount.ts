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

export function resolveDepositAsset(dep: {
  method?: string | null;
  tokenSymbol?: string | null;
}): DepositAsset {
  return dep.method === 'vfxt_bep20' || dep.tokenSymbol === 'VFXT' ? 'VFXT' : 'USDT';
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
  return baseWeiForAsset(Number(dep.amountMinor), resolveDepositAsset(dep));
}

/** Whole-token / whole-cent base wei before the unique payment tag. */
export function resolveDepositBaseWei(dep: {
  amountMinor?: number;
  method?: string | null;
  tokenSymbol?: string | null;
}): bigint {
  return baseWeiForAsset(Number(dep.amountMinor), resolveDepositAsset(dep));
}

/**
 * Wallets often send the round amount (10 VFXT) instead of the tagged unique
 * amount (10.000000000000524707). Accept both the exact tag and the base amount.
 */
export function depositWeiCandidates(dep: {
  expectedWei?: string | null;
  amountMinor?: number;
  method?: string | null;
  tokenSymbol?: string | null;
}): bigint[] {
  const expected = resolveDepositExpectedWei(dep);
  const base = resolveDepositBaseWei(dep);
  return expected === base ? [expected] : [expected, base];
}

/**
 * Round (base) amounts may match many open deposits. Only the oldest open
 * deposit for the same amount + asset + receive address may claim a base payment.
 */
export async function canAcceptBaseWeiPayment(
  db: Firestore,
  depositId: string,
  dep: {
    amountMinor?: number;
    method?: string | null;
    tokenSymbol?: string | null;
    depositAddress?: string | null;
    createdAt?: { toMillis?: () => number } | null;
  },
): Promise<boolean> {
  const asset = resolveDepositAsset(dep);
  const method = asset === 'VFXT' ? 'vfxt_bep20' : 'usdt_bep20';
  const amountMinor = Number(dep.amountMinor);
  const address = (dep.depositAddress || '').toLowerCase();

  const open = await db
    .collection(Collections.deposits)
    .where('status', 'in', ['pending', 'awaiting_payment'])
    .limit(100)
    .get();

  const peers = open.docs
    .map((doc) => ({ id: doc.id, data: doc.data() }))
    .filter((row) => {
      if (Number(row.data.amountMinor) !== amountMinor) return false;
      const rowMethod = String(row.data.method || '');
      if (rowMethod && rowMethod !== method) return false;
      if (row.data.tokenSymbol && row.data.tokenSymbol !== asset) return false;
      const rowAddr = String(row.data.depositAddress || '').toLowerCase();
      if (address && rowAddr && rowAddr !== address) return false;
      return true;
    })
    .sort((a, b) => {
      const am = a.data.createdAt?.toMillis?.() ?? 0;
      const bm = b.data.createdAt?.toMillis?.() ?? 0;
      return am - bm;
    });

  return peers[0]?.id === depositId;
}

/** Candidates for verification — base wei only if this deposit may claim it. */
export async function depositWeiCandidatesForCredit(
  db: Firestore,
  depositId: string,
  dep: {
    expectedWei?: string | null;
    amountMinor?: number;
    method?: string | null;
    tokenSymbol?: string | null;
    depositAddress?: string | null;
    createdAt?: { toMillis?: () => number } | null;
  },
): Promise<bigint[]> {
  const expected = resolveDepositExpectedWei(dep);
  const base = resolveDepositBaseWei(dep);
  if (expected === base) return [expected];
  if (await canAcceptBaseWeiPayment(db, depositId, dep)) {
    return [expected, base];
  }
  return [expected];
}
