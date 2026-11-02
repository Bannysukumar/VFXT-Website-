/**
 * VFXT business-plan constants and pure helpers (server-authoritative).
 *
 * Money (tokens-only ledger):
 * - Fund / staking / ROI / level / withdrawal / referral / vfxt store whole VFXT tokens (decimals=0).
 * - USDT appears only at deposit intake (convert → tokens) and withdrawal payout (tokens → USDT).
 * - Price: default $0.0001 / VFXT ⇒ $1 = 10_000 VFXT.
 */

export const VFXT_PRICE_USD = 0.0001;
/** Whole VFXT tokens per $1 USDT (default; override via platform.token.tokensPerUsd). */
export const VFXT_PER_USDT = 10_000;
/** @deprecated Prefer platform.token.tokensPerUsd — kept as DEFAULT_VFXT_PER_USD alias. */
export const DEFAULT_VFXT_PER_USD = VFXT_PER_USDT;
/** VFXT wallet decimals — whole tokens. */
export const VFXT_DECIMALS = 0;
/** Legacy USD wallet decimals — cents (withdraw USDT wire amounts only). */
export const USD_DECIMALS = 2;

/** Legacy USD min stake ($100). Prefer MIN_STAKE_VFXT_TOKENS for new stakes. */
export const MIN_STAKE_USD_CENTS = 10_000; // $100
/** Default min stake in whole VFXT tokens ($100 at default price). */
export const MIN_STAKE_VFXT_TOKENS = MIN_STAKE_USD_CENTS * (VFXT_PER_USDT / 100);

export const DAILY_YIELD = {
  /** 1% of principal per day = 100 bps. */
  dailyRateBps: 100,
  maxDays: 200,
  /** Cap on totalPaidMinor as multiple of principal. */
  nonWorkingCapX: 2,
  workingCapX: 3,
} as const;

/** One yield day = exactly 24 hours from the stake timestamp (wall-clock / IST-local). */
export const DAILY_YIELD_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * When the next 1% ROI credit is due for a daily_yield position.
 * Anchor is stake `createdAt`: day 1 at +24h, day 2 at +48h, etc.
 */
export function nextDailyYieldDueAtMs(
  createdAtMs: number,
  daysPaid: number,
): number {
  return createdAtMs + (daysPaid + 1) * DAILY_YIELD_INTERVAL_MS;
}

/** True when now is at/after the next 24h anniversary of the stake. */
export function isDailyYieldDue(params: {
  createdAtMs: number;
  daysPaid: number;
  nowMs: number;
}): boolean {
  if (!Number.isFinite(params.createdAtMs) || params.createdAtMs <= 0) {
    return false;
  }
  return (
    params.nowMs >=
    nextDailyYieldDueAtMs(params.createdAtMs, params.daysPaid)
  );
}

export type LockedPackageId = 'locked_300' | 'locked_500' | 'locked_700';

export const LOCKED_PACKAGES = [
  {
    id: 'locked_300' as const,
    days: 300,
    multiplier: 3,
    bonusTokenPct: 50,
    label: '300-day · 3X',
  },
  {
    id: 'locked_500' as const,
    days: 500,
    multiplier: 5,
    bonusTokenPct: 100,
    label: '500-day · 5X',
  },
  {
    id: 'locked_700' as const,
    days: 700,
    multiplier: 7,
    bonusTokenPct: 150,
    label: '700-day · 7X',
  },
] as const;

export type StakingPlanId = 'daily_yield' | LockedPackageId;

/** L1…L7 commission on stake capital, in basis points (0.50% … 0.10%). */
export const LEVEL_COMMISSION_BPS = [50, 50, 25, 25, 20, 20, 10] as const;

/** Direct referral bonus: 5% of stake as VFXT tokens. */
export const DIRECT_REFERRAL_BONUS_BPS = 500;

/**
 * Binary rank rewards. Volumes and rewards expressed in whole USD,
 * converted to cents via helpers.
 */
/** Default max salary cycles per rank before payouts pause until next rank. */
export const DEFAULT_RANK_MAX_CYCLES = 12;

export const RANK_REWARDS = [
  { rank: 1, leftUsd: 1_000, rightUsd: 1_000, rewardUsd: 10, cycleDays: 7, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 2, leftUsd: 2_000, rightUsd: 2_000, rewardUsd: 20, cycleDays: 7, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 3, leftUsd: 5_000, rightUsd: 5_000, rewardUsd: 50, cycleDays: 7, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 4, leftUsd: 10_000, rightUsd: 10_000, rewardUsd: 100, cycleDays: 15, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 5, leftUsd: 15_000, rightUsd: 15_000, rewardUsd: 150, cycleDays: 15, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 6, leftUsd: 20_000, rightUsd: 20_000, rewardUsd: 200, cycleDays: 15, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 7, leftUsd: 30_000, rightUsd: 30_000, rewardUsd: 300, cycleDays: 30, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 8, leftUsd: 50_000, rightUsd: 50_000, rewardUsd: 500, cycleDays: 30, maxCycles: DEFAULT_RANK_MAX_CYCLES },
  { rank: 9, leftUsd: 100_000, rightUsd: 100_000, rewardUsd: 1_000, cycleDays: 30, maxCycles: DEFAULT_RANK_MAX_CYCLES },
] as const;

export type WalletKind =
  | 'fund'
  | 'staking'
  | 'daily_roi'
  | 'level_income'
  | 'direct_referral'
  | 'withdrawal'
  | 'vfxt';

export const WALLET_KINDS: readonly WalletKind[] = [
  'fund',
  'staking',
  'daily_roi',
  'level_income',
  'direct_referral',
  'withdrawal',
  'vfxt',
] as const;

export const WALLET_CURRENCY: Record<WalletKind, 'USD' | 'VFXT'> = {
  fund: 'VFXT',
  staking: 'VFXT',
  daily_roi: 'VFXT',
  level_income: 'VFXT',
  direct_referral: 'VFXT',
  withdrawal: 'VFXT',
  vfxt: 'VFXT',
};

export const WALLET_DECIMALS: Record<WalletKind, number> = {
  fund: VFXT_DECIMALS,
  staking: VFXT_DECIMALS,
  daily_roi: VFXT_DECIMALS,
  level_income: VFXT_DECIMALS,
  direct_referral: VFXT_DECIMALS,
  withdrawal: VFXT_DECIMALS,
  vfxt: VFXT_DECIMALS,
};

/**
 * Allowed transferBetweenWallets routes (all VFXT → VFXT, 1:1).
 * fund → staking is only via createStakingPosition (not listed here).
 */
export const ALLOWED_TRANSFERS: ReadonlyArray<{
  from: WalletKind;
  to: WalletKind;
}> = [
  { from: 'daily_roi', to: 'withdrawal' },
  { from: 'level_income', to: 'withdrawal' },
  { from: 'direct_referral', to: 'staking' },
  { from: 'direct_referral', to: 'withdrawal' },
];

/**
 * USD cents → whole VFXT tokens.
 * Default rate: $1 = 100 cents = 10_000 VFXT ⇒ tokens = cents * tokensPerUsd / 100.
 */
export function usdCentsToVfxtTokens(
  cents: number,
  tokensPerUsd: number = DEFAULT_VFXT_PER_USD,
): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error('usdCents must be a non-negative integer');
  }
  if (!Number.isInteger(tokensPerUsd) || tokensPerUsd <= 0) {
    throw new Error('tokensPerUsd must be a positive integer');
  }
  return Math.floor((cents * tokensPerUsd) / 100);
}

/** Inverse of usdCentsToVfxtTokens (truncates toward zero). */
export function vfxtTokensToUsdCents(
  tokens: number,
  tokensPerUsd: number = DEFAULT_VFXT_PER_USD,
): number {
  if (!Number.isInteger(tokens) || tokens < 0) {
    throw new Error('tokens must be a non-negative integer');
  }
  if (!Number.isInteger(tokensPerUsd) || tokensPerUsd <= 0) {
    throw new Error('tokensPerUsd must be a positive integer');
  }
  return Math.floor((tokens * 100) / tokensPerUsd);
}

/**
 * @deprecated Fund Wallet is tokens now — use the token amount directly.
 * Kept for older call sites; returns whole tokens unchanged.
 */
export function vfxtTokensToFundCents(
  tokens: number,
  _tokensPerUsd: number = DEFAULT_VFXT_PER_USD,
): number {
  if (!Number.isInteger(tokens) || tokens <= 0) return 0;
  return tokens;
}

/** Minimum whole VFXT tokens that map to at least $0.01 Fund credit. */
export function minVfxtTokensForOneCent(
  tokensPerUsd: number = DEFAULT_VFXT_PER_USD,
): number {
  if (!Number.isInteger(tokensPerUsd) || tokensPerUsd <= 0) return 1;
  return Math.max(1, Math.ceil(tokensPerUsd / 100));
}

/** Withdrawal fee + net payout. */
export function splitWithdrawalCommission(
  amountMinor: number,
  commissionBps: number,
): { commissionMinor: number; netMinor: number } {
  const bps = Math.max(0, Math.min(10_000, Math.floor(commissionBps)));
  const commissionMinor = Math.floor((amountMinor * bps) / 10_000);
  return { commissionMinor, netMinor: amountMinor - commissionMinor };
}

/** Daily 1% of principal in cents (floor). */
export function dailyYieldCents(principalCents: number): number {
  return Math.floor((principalCents * DAILY_YIELD.dailyRateBps) / 10_000);
}

/** Max totalPaidMinor for a daily-yield position. */
export function payoutCapCents(
  principalCents: number,
  working: boolean,
): number {
  const x = working
    ? DAILY_YIELD.workingCapX
    : DAILY_YIELD.nonWorkingCapX;
  return principalCents * x;
}

/** Whether a daily-yield position should stop. */
export function shouldStopDailyYield(params: {
  daysPaid: number;
  totalPaidMinor: number;
  capMinor: number;
}): boolean {
  return (
    params.daysPaid >= DAILY_YIELD.maxDays ||
    params.totalPaidMinor >= params.capMinor
  );
}

/**
 * Yield to credit today, clamped so totalPaid never exceeds cap.
 * Returns 0 if already stopped.
 */
export function nextDailyYieldCents(params: {
  principalCents: number;
  daysPaid: number;
  totalPaidMinor: number;
  capMinor: number;
}): number {
  if (shouldStopDailyYield(params)) return 0;
  const raw = dailyYieldCents(params.principalCents);
  const remaining = params.capMinor - params.totalPaidMinor;
  if (remaining <= 0) return 0;
  return Math.min(raw, remaining);
}

/** Level commission in whole VFXT tokens for a stake (floor). */
export function levelCommissionCents(
  stakeTokens: number,
  level: number,
): number {
  if (level < 1 || level > LEVEL_COMMISSION_BPS.length) return 0;
  const bps = LEVEL_COMMISSION_BPS[level - 1]!;
  return Math.floor((stakeTokens * bps) / 10_000);
}

/** Direct referral bonus as whole VFXT tokens (5% of stake tokens). */
export function directReferralBonusTokens(stakeTokens: number): number {
  return Math.floor((stakeTokens * DIRECT_REFERRAL_BONUS_BPS) / 10_000);
}

/** Unlock: earn level N only if upline has ≥ N direct referrals. */
export function isLevelUnlocked(
  directReferralCount: number,
  level: number,
): boolean {
  return directReferralCount >= level;
}

export function getLockedPackage(id: LockedPackageId) {
  return LOCKED_PACKAGES.find((p) => p.id === id) ?? null;
}

/**
 * Locked maturity payouts (tokens-only):
 * - token credit = principalTokens * multiplier → withdrawal
 * - VFXT bonus = principalTokens * bonusTokenPct / 100 → vfxt wallet
 */
export function lockedMaturityPayout(params: {
  principalCents: number;
  multiplier: number;
  bonusTokenPct: number;
}): { usdCreditCents: number; bonusVfxtTokens: number } {
  const principalTokens = params.principalCents;
  const usdCreditCents = principalTokens * params.multiplier;
  const bonusVfxtTokens = Math.floor(
    (principalTokens * params.bonusTokenPct) / 100,
  );
  return { usdCreditCents, bonusVfxtTokens };
}

/** Rank thresholds / reward in whole VFXT tokens (USD table × tokensPerUsd). */
export function rankThresholdCents(
  rank: number,
  tokensPerUsd: number = DEFAULT_VFXT_PER_USD,
): {
  leftMinor: number;
  rightMinor: number;
  rewardMinor: number;
  cycleDays: number;
  maxCycles: number;
} | null {
  const row = RANK_REWARDS.find((r) => r.rank === rank);
  if (!row) return null;
  const rate = Number.isInteger(tokensPerUsd) && tokensPerUsd > 0
    ? tokensPerUsd
    : DEFAULT_VFXT_PER_USD;
  return {
    leftMinor: row.leftUsd * rate,
    rightMinor: row.rightUsd * rate,
    rewardMinor: row.rewardUsd * rate,
    cycleDays: row.cycleDays,
    maxCycles: row.maxCycles ?? DEFAULT_RANK_MAX_CYCLES,
  };
}

/** Highest rank whose left/right volume thresholds are both met (0 if none). Volumes are VFXT tokens. */
export function qualifiedRank(
  leftVolumeMinor: number,
  rightVolumeMinor: number,
  tokensPerUsd: number = DEFAULT_VFXT_PER_USD,
): number {
  const rate = Number.isInteger(tokensPerUsd) && tokensPerUsd > 0
    ? tokensPerUsd
    : DEFAULT_VFXT_PER_USD;
  let best = 0;
  for (const row of RANK_REWARDS) {
    const leftNeed = row.leftUsd * rate;
    const rightNeed = row.rightUsd * rate;
    if (leftVolumeMinor >= leftNeed && rightVolumeMinor >= rightNeed) {
      best = row.rank;
    } else {
      break;
    }
  }
  return best;
}

export function isTransferAllowed(
  from: WalletKind,
  to: WalletKind,
): boolean {
  return ALLOWED_TRANSFERS.some((r) => r.from === from && r.to === to);
}
