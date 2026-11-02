import { formatUnits } from 'ethers';
import type { Firestore } from 'firebase-admin/firestore';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  USDT_DECIMALS,
  VFXT_TOKEN_DECIMALS,
  usdCentsToUsdtWei,
} from '../../config/bsc';

/**
 * Unique tags use 4 visible decimals so wallets (Trust / MetaMask) show and send
 * the exact amount, e.g. 10.7641 — not 6+ digits that get truncated mid-payment.
 * 1 tag unit = 10^(decimals-4) wei = 0.0001 token.
 */
const VISIBLE_DECIMALS = 4;
const MAX_PAYMENT_TAG = 9_999;
/** Previous 6-decimal scheme — still detect reserved tags / accept old payments. */
const LEGACY_VISIBLE_DECIMALS = 6;
const LEGACY_MAX_PAYMENT_TAG = 999_999;

export type DepositAsset = 'USDT' | 'VFXT';

function tagUnitWei(decimals: number, visible = VISIBLE_DECIMALS): bigint {
  return 10n ** BigInt(decimals - visible);
}

/**
 * USDT: amountMinor = USD cents → USDT wei (1:1).
 * VFXT: amountMinor = whole tokens → VFXT wei (18 decimals).
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

/** Human amount: round when tag=0, else fixed 4 decimals (wallet-safe). */
export function formatUniqueAmountDisplay(wei: bigint, decimals: number): string {
  const raw = formatUnits(wei, decimals);
  const [whole, fracRaw = ''] = raw.split('.');
  const frac = `${fracRaw}0000`.slice(0, VISIBLE_DECIMALS);
  if (/^0+$/.test(frac)) {
    return decimals === USDT_DECIMALS ? `${whole}.00` : whole;
  }
  return `${whole}.${frac}`;
}

function extractPaymentTag(
  expectedWei: bigint,
  base: bigint,
  decimals: number,
): number | null {
  if (expectedWei < base) return null;
  const delta = expectedWei - base;

  const unit4 = tagUnitWei(decimals, VISIBLE_DECIMALS);
  if (delta % unit4 === 0n) {
    const tag = Number(delta / unit4);
    if (Number.isInteger(tag) && tag >= 0 && tag <= MAX_PAYMENT_TAG) return tag;
  }

  const unit6 = tagUnitWei(decimals, LEGACY_VISIBLE_DECIMALS);
  if (delta % unit6 === 0n) {
    const tag = Number(delta / unit6);
    if (Number.isInteger(tag) && tag >= 0 && tag <= LEGACY_MAX_PAYMENT_TAG) {
      // Map legacy 6-dp tag into 4-dp occupancy buckets so new tags don't collide.
      return Math.min(MAX_PAYMENT_TAG, Math.floor(tag / 100) || tag);
    }
  }

  if (delta <= BigInt(LEGACY_MAX_PAYMENT_TAG)) {
    const tag = Number(delta);
    if (Number.isInteger(tag) && tag >= 0) return Math.min(MAX_PAYMENT_TAG, tag);
  }

  return null;
}

/** Truncate wei down to N visible decimals (wallet truncation). */
function truncateToVisibleWei(wei: bigint, decimals: number, visible: number): bigint {
  const unit = tagUnitWei(decimals, visible);
  return (wei / unit) * unit;
}

/**
 * Allocate on-chain expected wei for a deposit:
 * - If nobody else is awaiting this same amount+asset → usual round amount (tag 0).
 * - If another awaiting deposit already owns the round amount → add visible 4-decimal
 *   uniqueness (tag 1…9999), e.g. 10.7641.
 *
 * Pending (manual-review) deposits are ignored — payment already submitted.
 * Expected amount is frozen at create time and must not change mid-payment.
 */
export async function allocateUniqueDepositWei(
  db: Firestore,
  amountMinor: number,
  options?: { asset?: DepositAsset },
): Promise<{ expectedWei: string; amountDisplay: string; paymentTag: number }> {
  const asset: DepositAsset = options?.asset ?? 'USDT';
  const decimals = asset === 'VFXT' ? VFXT_TOKEN_DECIMALS : USDT_DECIMALS;
  const base = baseWeiForAsset(amountMinor, asset);
  const unit = tagUnitWei(decimals);
  const method = asset === 'VFXT' ? 'vfxt_bep20' : 'usdt_bep20';

  // Only deposits still waiting for payment compete for unique amounts.
  const open = await db
    .collection(Collections.deposits)
    .where('status', '==', 'awaiting_payment')
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
      const tag = extractPaymentTag(BigInt(String(data.expectedWei)), base, decimals);
      if (tag != null) usedTags.add(tag);
    } catch {
      /* ignore malformed */
    }
  }

  if (!usedTags.has(0)) {
    return {
      expectedWei: base.toString(),
      amountDisplay: formatUniqueAmountDisplay(base, decimals),
      paymentTag: 0,
    };
  }

  const start = (Date.now() % MAX_PAYMENT_TAG) + 1;
  for (let i = 0; i < MAX_PAYMENT_TAG; i++) {
    const tag = ((start + i - 1) % MAX_PAYMENT_TAG) + 1;
    if (usedTags.has(tag)) continue;
    const wei = base + BigInt(tag) * unit;
    return {
      expectedWei: wei.toString(),
      amountDisplay: formatUniqueAmountDisplay(wei, decimals),
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

export function resolveDepositBaseWei(dep: {
  amountMinor?: number;
  method?: string | null;
  tokenSymbol?: string | null;
}): bigint {
  return baseWeiForAsset(Number(dep.amountMinor), resolveDepositAsset(dep));
}

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

type OpenDepositPeer = {
  amountMinor?: number;
  method?: string | null;
  tokenSymbol?: string | null;
  depositAddress?: string | null;
  createdAt?: { toMillis?: () => number } | null;
  expectedWei?: string | null;
  paymentTag?: number | null;
};

async function listAwaitingSameAmountPeers(
  db: Firestore,
  dep: OpenDepositPeer,
): Promise<Array<{ id: string; data: OpenDepositPeer & Record<string, unknown> }>> {
  const asset = resolveDepositAsset(dep);
  const method = asset === 'VFXT' ? 'vfxt_bep20' : 'usdt_bep20';
  const amountMinor = Number(dep.amountMinor);
  const address = (dep.depositAddress || '').toLowerCase();

  const open = await db
    .collection(Collections.deposits)
    .where('status', '==', 'awaiting_payment')
    .limit(100)
    .get();

  return open.docs
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
}

/**
 * Round (base) amounts may match many open deposits. Only the oldest awaiting
 * deposit for the same amount + asset + receive address may claim a base payment.
 */
export async function canAcceptBaseWeiPayment(
  db: Firestore,
  depositId: string,
  dep: OpenDepositPeer,
): Promise<boolean> {
  const peers = await listAwaitingSameAmountPeers(db, dep);
  if (peers.length <= 1) return peers[0]?.id === depositId || peers.length === 0;
  return peers[0]?.id === depositId;
}

/**
 * Keep the amount frozen after create. Never rewrite expectedWei mid-payment —
 * that caused users to pay 10.7641 while the page later showed 10.756579.
 */
export async function normalizeDepositAmountIfSole(
  _db: Firestore,
  _depositId: string,
  dep: OpenDepositPeer & { qrPayload?: string | null; tokenAddress?: string | null; chainId?: number | null },
): Promise<{
  expectedWei: string;
  amountDisplay: string;
  paymentTag: number;
  normalized: boolean;
  previousExpectedWei: string | null;
}> {
  const asset = resolveDepositAsset(dep);
  const decimals = asset === 'VFXT' ? VFXT_TOKEN_DECIMALS : USDT_DECIMALS;
  const base = resolveDepositBaseWei(dep);
  const current = resolveDepositExpectedWei(dep);
  const previousExpectedWei = dep.expectedWei ? String(dep.expectedWei) : null;
  const tag = extractPaymentTag(current, base, decimals) ?? Number(dep.paymentTag ?? 0);

  return {
    expectedWei: current.toString(),
    amountDisplay: formatUniqueAmountDisplay(current, decimals),
    paymentTag: tag,
    normalized: false,
    previousExpectedWei,
  };
}

/** Candidates for verification — exact tag, 4-dp truncation, and base when allowed. */
export async function depositWeiCandidatesForCredit(
  db: Firestore,
  depositId: string,
  dep: OpenDepositPeer & { previousExpectedWei?: string | null },
): Promise<bigint[]> {
  const asset = resolveDepositAsset(dep);
  const decimals = asset === 'VFXT' ? VFXT_TOKEN_DECIMALS : USDT_DECIMALS;
  const expected = resolveDepositExpectedWei(dep);
  const base = resolveDepositBaseWei(dep);
  const candidates = new Set<string>();
  candidates.add(expected.toString());

  // Wallet may truncate 6-dp unique amounts to 4 decimals when sending.
  const truncated4 = truncateToVisibleWei(expected, decimals, VISIBLE_DECIMALS);
  if (truncated4 !== expected) candidates.add(truncated4.toString());

  if (dep.previousExpectedWei) {
    try {
      const prev = BigInt(String(dep.previousExpectedWei));
      candidates.add(prev.toString());
      const prevTrunc = truncateToVisibleWei(prev, decimals, VISIBLE_DECIMALS);
      if (prevTrunc !== prev) candidates.add(prevTrunc.toString());
    } catch {
      /* ignore */
    }
  }

  if (expected === base || (await canAcceptBaseWeiPayment(db, depositId, dep))) {
    candidates.add(base.toString());
  }

  return [...candidates].map((w) => BigInt(w));
}
