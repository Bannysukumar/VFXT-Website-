/** Client-visible VFXT plan constants (server remains authoritative). */

export const VFXT_PRICE_USD = 0.0001
export const VFXT_PER_USDT = 10_000
export const MIN_STAKE_USD_CENTS = 10_000 // $100

export const DAILY_YIELD = {
  dailyRateBps: 100, // 1% = 100 basis points of principal
  maxDays: 200,
  nonWorkingCapX: 2,
  workingCapX: 3,
} as const

export const LOCKED_PACKAGES = [
  { id: 'locked_300' as const, days: 300, multiplier: 3, bonusTokenPct: 50, label: '300-day · 3X' },
  { id: 'locked_500' as const, days: 500, multiplier: 5, bonusTokenPct: 100, label: '500-day · 5X' },
  { id: 'locked_700' as const, days: 700, multiplier: 7, bonusTokenPct: 150, label: '700-day · 7X' },
]

export const LEVEL_COMMISSION_BPS = [50, 50, 25, 25, 20, 20, 10] as const // 0.50% … 0.10%

export const DIRECT_REFERRAL_BONUS_BPS = 500 // 5%

export const RANK_REWARDS = [
  { rank: 1, leftUsd: 1_000, rightUsd: 1_000, rewardUsd: 10, cycleDays: 7 },
  { rank: 2, leftUsd: 2_000, rightUsd: 2_000, rewardUsd: 20, cycleDays: 7 },
  { rank: 3, leftUsd: 5_000, rightUsd: 5_000, rewardUsd: 50, cycleDays: 7 },
  { rank: 4, leftUsd: 10_000, rightUsd: 10_000, rewardUsd: 100, cycleDays: 15 },
  { rank: 5, leftUsd: 15_000, rightUsd: 15_000, rewardUsd: 150, cycleDays: 15 },
  { rank: 6, leftUsd: 20_000, rightUsd: 20_000, rewardUsd: 200, cycleDays: 15 },
  { rank: 7, leftUsd: 30_000, rightUsd: 30_000, rewardUsd: 300, cycleDays: 30 },
  { rank: 8, leftUsd: 50_000, rightUsd: 50_000, rewardUsd: 500, cycleDays: 30 },
  { rank: 9, leftUsd: 100_000, rightUsd: 100_000, rewardUsd: 1_000, cycleDays: 30 },
] as const

export type WalletKind =
  | 'fund'
  | 'staking'
  | 'daily_roi'
  | 'level_income'
  | 'direct_referral'
  | 'withdrawal'
  | 'vfxt'

export const WALLET_META: Record<
  WalletKind,
  { label: string; description: string; currency: 'USD' | 'VFXT' }
> = {
  fund: {
    label: 'Fund Wallet',
    description: 'Deposits and platform funding for staking.',
    currency: 'USD',
  },
  staking: {
    label: 'Staking Wallet',
    description: 'Active / locked staking principal.',
    currency: 'USD',
  },
  daily_roi: {
    label: 'Daily ROI Wallet',
    description: '1% daily yield credits (regular plan).',
    currency: 'USD',
  },
  level_income: {
    label: 'Level Income Wallet',
    description: 'Seven-level affiliate commissions on capital.',
    currency: 'USD',
  },
  direct_referral: {
    label: 'Direct Referral Wallet',
    description: '5% restaking token bonus from directs.',
    currency: 'VFXT',
  },
  withdrawal: {
    label: 'Withdrawal Wallet',
    description: 'Eligible balance for withdrawal requests.',
    currency: 'USD',
  },
  vfxt: {
    label: 'VFXT Wallet',
    description: 'Utility token balance (10,000 VFXT = 1 USDT).',
    currency: 'VFXT',
  },
}

/** Default VFXT per $1 (overridden by platform.token.tokensPerUsd). */
export const DEFAULT_VFXT_PER_USD = 10_000

/** USD cents → whole VFXT tokens. */
export function usdCentsToVfxtTokens(cents: number, tokensPerUsd = DEFAULT_VFXT_PER_USD): number {
  return Math.floor((cents * tokensPerUsd) / 100)
}

/** Whole VFXT tokens → USD cents (truncates toward zero). */
export function vfxtTokensToUsdCents(tokens: number, tokensPerUsd = DEFAULT_VFXT_PER_USD): number {
  if (!Number.isFinite(tokens) || tokens < 0 || tokensPerUsd <= 0) return 0
  return Math.floor((tokens * 100) / tokensPerUsd)
}

/** VFXT → Fund Wallet cents (round nearest, min $0.01 for positive token amounts). */
export function vfxtTokensToFundCents(tokens: number, tokensPerUsd = DEFAULT_VFXT_PER_USD): number {
  if (!Number.isFinite(tokens) || tokens <= 0 || tokensPerUsd <= 0) return 0
  return Math.max(1, Math.round((tokens * 100) / tokensPerUsd))
}

export function minVfxtTokensForOneCent(tokensPerUsd = DEFAULT_VFXT_PER_USD): number {
  if (!Number.isFinite(tokensPerUsd) || tokensPerUsd <= 0) return 1
  return Math.max(1, Math.ceil(tokensPerUsd / 100))
}

export function splitWithdrawalCommission(
  amountMinor: number,
  commissionBps: number,
): { commissionMinor: number; netMinor: number } {
  const bps = Math.max(0, Math.min(10_000, Math.floor(commissionBps)))
  const commissionMinor = Math.floor((amountMinor * bps) / 10_000)
  return { commissionMinor, netMinor: amountMinor - commissionMinor }
}

export function dailyYieldCents(principalCents: number): number {
  return Math.floor((principalCents * DAILY_YIELD.dailyRateBps) / 10_000)
}

export function payoutCapCents(principalCents: number, working: boolean): number {
  const x = working ? DAILY_YIELD.workingCapX : DAILY_YIELD.nonWorkingCapX
  return principalCents * x
}
