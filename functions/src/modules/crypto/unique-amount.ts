import { formatUnits } from 'ethers';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { Collections } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  USDT_DECIMALS,
  VFXT_TOKEN_DECIMALS,
  usdCentsToUsdtWei,
} from '../../config/bsc';

/**
 * Unique tags are scaled into the visible 6-decimal range so Trust / MetaMask /
 * VFXT Wallet show and send e.g. 10.524707 instead of rounding to 10.00.
 * 1 tag unit = 10^(decimals-6) wei = 0.000001 token.
 */
const VISIBLE_DECIMALS = 6;
const MAX_PAYMENT_TAG = 999_999;

export type DepositAsset = 'USDT' | 'VFXT';

function tagUnitWei(decimals: number): bigint {
  return 10n ** BigInt(decimals - VISIBLE_DECIMALS);
}

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

/** Human amount: round when tag=0, else fixed 6 decimals (wallet-safe). */
export function formatUniqueAmountDisplay(wei: bigint, decimals: number): string {
  const raw = formatUnits(wei, decimals);
  const [whole, fracRaw = ''] = raw.split('.');
  const frac = `${fracRaw}000000`.slice(0, VISIBLE_DECIMALS);
  if (/^0+$/.test(frac)) {
    // Sole open deposit for this amount — usual round amount (no unique decimals).
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
  const unit = tagUnitWei(decimals);

  // New scheme: visible 6-decimal tags.
  if (delta % unit === 0n) {
    const tag = Number(delta / unit);
    if (Number.isInteger(tag) && tag >= 0 && tag <= MAX_PAYMENT_TAG) return tag;
  }

  // Legacy scheme: raw wei tags (1…999999) — still detect so old opens don't collide.
  if (delta <= BigInt(MAX_PAYMENT_TAG)) {
    const tag = Number(delta);
    if (Number.isInteger(tag) && tag >= 0) return tag;
  }

  return null;
}

/**
 * Allocate on-chain expected wei for a deposit:
 * - If nobody else is awaiting this same amount+asset → usual round amount (tag 0).
 * - If another open deposit already owns the round amount → add visible 6-decimal
 *   uniqueness so both payments can be matched (tag 1…999999).
 *
 * Formula when tagged: baseWei + paymentTag * 10^(decimals-6)
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
      const tag = extractPaymentTag(BigInt(String(data.expectedWei)), base, decimals);
      if (tag != null) usedTags.add(tag);
    } catch {
      /* ignore malformed */
    }
  }

  // Prefer the usual round amount whenever it is free (single depositor case).
  if (!usedTags.has(0)) {
    return {
      expectedWei: base.toString(),
      amountDisplay: formatUniqueAmountDisplay(base, decimals),
      paymentTag: 0,
    };
  }

  // Concurrent same-amount deposit(s) — assign a visible unique decimal amount.
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

/** Whole-token / whole-cent base wei before the unique payment tag. */
export function resolveDepositBaseWei(dep: {
  amountMinor?: number;
  method?: string | null;
  tokenSymbol?: string | null;
}): bigint {
  return baseWeiForAsset(Number(dep.amountMinor), resolveDepositAsset(dep));
}

/**
 * Wallets sometimes still send the round amount (10 USDT / 10 VFXT).
 * Accept both the exact tagged amount and the base amount when allowed.
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

type OpenDepositPeer = {
  amountMinor?: number;
  method?: string | null;
  tokenSymbol?: string | null;
  depositAddress?: string | null;
  createdAt?: { toMillis?: () => number } | null;
  expectedWei?: string | null;
  paymentTag?: number | null;
};

async function listOpenSameAmountPeers(
  db: Firestore,
  dep: OpenDepositPeer,
): Promise<Array<{ id: string; data: OpenDepositPeer & Record<string, unknown> }>> {
  const asset = resolveDepositAsset(dep);
  const method = asset === 'VFXT' ? 'vfxt_bep20' : 'usdt_bep20';
  const amountMinor = Number(dep.amountMinor);
  const address = (dep.depositAddress || '').toLowerCase();

  const open = await db
    .collection(Collections.deposits)
    .where('status', 'in', ['pending', 'awaiting_payment'])
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
 * Round (base) amounts may match many open deposits. Only the oldest open
 * deposit for the same amount + asset + receive address may claim a base payment.
 * If this deposit is the only open one for that amount, it may always claim base.
 */
export async function canAcceptBaseWeiPayment(
  db: Firestore,
  depositId: string,
  dep: OpenDepositPeer,
): Promise<boolean> {
  const peers = await listOpenSameAmountPeers(db, dep);
  if (peers.length <= 1) return peers[0]?.id === depositId || peers.length === 0;
  return peers[0]?.id === depositId;
}

/**
 * When concurrent peers finish and this deposit is alone for its amount,
 * clear unique decimals so the user pays the usual round amount again.
 * Still accepts the old tagged amount if they already copied/sent it.
 */
export async function normalizeDepositAmountIfSole(
  db: Firestore,
  depositId: string,
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

  if (current === base) {
    return {
      expectedWei: base.toString(),
      amountDisplay: formatUniqueAmountDisplay(base, decimals),
      paymentTag: 0,
      normalized: false,
      previousExpectedWei,
    };
  }

  const peers = await listOpenSameAmountPeers(db, dep);
  const sole = peers.length <= 1 && (peers.length === 0 || peers[0]?.id === depositId);
  if (!sole) {
    return {
      expectedWei: current.toString(),
      amountDisplay: formatUniqueAmountDisplay(current, decimals),
      paymentTag: Number(dep.paymentTag ?? extractPaymentTag(current, base, decimals) ?? 0),
      normalized: false,
      previousExpectedWei,
    };
  }

  const amountDisplay = formatUniqueAmountDisplay(base, decimals);
  const tokenAddress = dep.tokenAddress ? String(dep.tokenAddress) : null;
  const chainId = Number(dep.chainId ?? 56);
  const qrPayload =
    tokenAddress != null
      ? `ethereum:${tokenAddress}@${chainId}/transfer?address=${dep.depositAddress}&uint256=${base.toString()}`
      : (dep.qrPayload ?? null);

  await db.collection(Collections.deposits).doc(depositId).update({
    expectedWei: base.toString(),
    amountUsdt: amountDisplay,
    paymentTag: 0,
    qrPayload,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {
    expectedWei: base.toString(),
    amountDisplay,
    paymentTag: 0,
    normalized: true,
    previousExpectedWei,
  };
}

/** Candidates for verification — base wei if sole/oldest; always keep tagged amount too. */
export async function depositWeiCandidatesForCredit(
  db: Firestore,
  depositId: string,
  dep: OpenDepositPeer & { previousExpectedWei?: string | null },
): Promise<bigint[]> {
  const expected = resolveDepositExpectedWei(dep);
  const base = resolveDepositBaseWei(dep);
  const candidates = new Set<string>();
  candidates.add(expected.toString());

  if (dep.previousExpectedWei) {
    try {
      candidates.add(BigInt(String(dep.previousExpectedWei)).toString());
    } catch {
      /* ignore */
    }
  }

  if (expected === base || (await canAcceptBaseWeiPayment(db, depositId, dep))) {
    candidates.add(base.toString());
  }

  return [...candidates].map((w) => BigInt(w));
}
