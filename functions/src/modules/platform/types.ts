import type { Timestamp, FieldValue } from 'firebase-admin/firestore';

export interface ContactSettings {
  companyName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  supportHours: string;
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  title: string;
  links: FooterLink[];
}

export type SocialPlatform =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'youtube'
  | 'linkedin'
  | 'telegram'
  | 'whatsapp'
  | 'discord'
  | 'tiktok'
  | 'github'
  | 'website'
  | 'other';

export interface SocialLink {
  id: string;
  platform: SocialPlatform;
  label: string;
  url: string;
  /** When false, link is hidden from the public footer. */
  visible: boolean;
}

export interface FooterSettings {
  tagline: string;
  copyright: string;
  columns: FooterColumn[];
  socials: SocialLink[];
}

export interface LockedPackageConfig {
  id: string;
  days: number;
  multiplier: number;
  bonusTokenPct: number;
  label: string;
  enabled: boolean;
}

export interface RankRewardConfig {
  rank: number;
  leftUsd: number;
  rightUsd: number;
  rewardUsd: number;
  cycleDays: number;
  enabled: boolean;
}

export interface PlanSettings {
  minStakeUsdCents: number;
  dailyRateBps: number;
  maxDays: number;
  nonWorkingCapX: number;
  workingCapX: number;
  levelCommissionBps: number[];
  directReferralBonusBps: number;
  lockedPackages: LockedPackageConfig[];
  rankRewards: RankRewardConfig[];
}

export interface WithdrawSettings {
  /** Minimum withdrawal amount in USD cents. */
  minWithdrawUsdCents: number;
  /** Withdrawal fee in basis points (500 = 5%). Deducted from payout; user is debited full amount. */
  commissionBps: number;
  /** When true, after first successful withdrawal, auto-submit when balance >= min. */
  autoWithdrawEnabled: boolean;
  /** Require saved profile address for auto-withdraw. */
  requireProfileAddress: boolean;
}

export interface DepositSettings {
  /** Minimum USDT/USD deposit amount in USD cents. */
  minDepositUsdCents: number;
  /** Minimum whole VFXT tokens for vfxt_bep20 deposits. */
  minVfxtDepositTokens: number;
}

export interface TokenEconomicsSettings {
  /**
   * Whole VFXT tokens credited per $1 USDT deposited.
   * Default 10_000 ⇒ $0.0001 per token. Price ≈ 1 / tokensPerUsd USD.
   */
  tokensPerUsd: number;
}

export interface HotWalletPoolSettings {
  /** When true, deposits/withdrawals pick a random enabled hot wallet. */
  multiWalletEnabled: boolean;
}

export interface PlatformSettings {
  contact: ContactSettings;
  footer: FooterSettings;
  plan: PlanSettings;
  deposit: DepositSettings;
  token: TokenEconomicsSettings;
  withdraw: WithdrawSettings;
  hotWalletPool: HotWalletPoolSettings;
  updatedAt?: Timestamp | FieldValue;
  updatedBy?: string;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  contact: {
    companyName: 'Virtual FX Trades',
    email: 'support@virtualfxtrades.com',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    region: '',
    postalCode: '',
    country: 'United States',
    supportHours: 'Mon–Fri 9:00–18:00 (US Eastern)',
  },
  footer: {
    tagline: 'Transparent trading infrastructure for modern investors.',
    copyright: '© Virtual FX Trades. All rights reserved.',
    columns: [
      {
        title: 'Product',
        links: [
          { label: 'Token', href: '/token' },
          { label: 'Security', href: '/security' },
          { label: 'Support', href: '/support' },
        ],
      },
      {
        title: 'Company',
        links: [
          { label: 'About', href: '/about' },
          { label: 'Contact', href: '/contact' },
        ],
      },
      {
        title: 'Legal',
        links: [
          { label: 'Terms', href: '/legal/terms' },
          { label: 'Privacy', href: '/legal/privacy' },
          { label: 'Risk', href: '/legal/risk' },
        ],
      },
    ],
    socials: [],
  },
  plan: {
    minStakeUsdCents: 10_000,
    dailyRateBps: 100,
    maxDays: 200,
    nonWorkingCapX: 2,
    workingCapX: 3,
    levelCommissionBps: [50, 50, 25, 25, 20, 20, 10],
    directReferralBonusBps: 500,
    lockedPackages: [
      { id: 'locked_300', days: 300, multiplier: 3, bonusTokenPct: 50, label: '300-day · 3X', enabled: true },
      { id: 'locked_500', days: 500, multiplier: 5, bonusTokenPct: 100, label: '500-day · 5X', enabled: true },
      { id: 'locked_700', days: 700, multiplier: 7, bonusTokenPct: 150, label: '700-day · 7X', enabled: true },
    ],
    rankRewards: [
      { rank: 1, leftUsd: 1_000, rightUsd: 1_000, rewardUsd: 10, cycleDays: 7, enabled: true },
      { rank: 2, leftUsd: 2_000, rightUsd: 2_000, rewardUsd: 20, cycleDays: 7, enabled: true },
      { rank: 3, leftUsd: 5_000, rightUsd: 5_000, rewardUsd: 50, cycleDays: 7, enabled: true },
      { rank: 4, leftUsd: 10_000, rightUsd: 10_000, rewardUsd: 100, cycleDays: 15, enabled: true },
      { rank: 5, leftUsd: 15_000, rightUsd: 15_000, rewardUsd: 150, cycleDays: 15, enabled: true },
      { rank: 6, leftUsd: 20_000, rightUsd: 20_000, rewardUsd: 200, cycleDays: 15, enabled: true },
      { rank: 7, leftUsd: 30_000, rightUsd: 30_000, rewardUsd: 300, cycleDays: 30, enabled: true },
      { rank: 8, leftUsd: 50_000, rightUsd: 50_000, rewardUsd: 500, cycleDays: 30, enabled: true },
      { rank: 9, leftUsd: 100_000, rightUsd: 100_000, rewardUsd: 1_000, cycleDays: 30, enabled: true },
    ],
  },
  deposit: {
    minDepositUsdCents: 1_000, // $10
    minVfxtDepositTokens: 10,
  },
  token: {
    tokensPerUsd: 10_000, // $0.0001 / VFXT
  },
  withdraw: {
    minWithdrawUsdCents: 1_000, // $10
    commissionBps: 500, // 5%
    autoWithdrawEnabled: false,
    requireProfileAddress: true,
  },
  hotWalletPool: {
    multiWalletEnabled: false,
  },
};
