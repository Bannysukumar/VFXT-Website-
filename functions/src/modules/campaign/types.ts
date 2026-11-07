import type { FieldValue, Timestamp } from 'firebase-admin/firestore';

export const CAMPAIGN_CONFIG_DOC = 'dashboardCampaign';
export const CAMPAIGN_PROGRESS = 'campaignProgress';
export const CAMPAIGN_VIEWS = 'campaignViews';

export type CampaignTierId = 'thailand' | 'vietnam' | 'dubai' | 'singapore' | string;

export interface CampaignTier {
  id: string;
  name: string;
  /** Target package volume in USD cents (e.g. 250000 = $2,500). */
  targetUsdCents: number;
  nightsLabel: string;
  sortOrder: number;
}

export interface DashboardCampaignConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  bannerUrl: string | null;
  storagePath: string | null;
  /** ISO or null — banner only during this window when set. */
  startsAt: Timestamp | FieldValue | string | null;
  endsAt: Timestamp | FieldValue | string | null;
  /**
   * How many times to show the banner per user after login/dashboard visit.
   * 0 = always show while campaign is active.
   */
  maxShows: number;
  requiredDirectReferrals: number;
  /** What counts toward package volume. */
  volumeSource: 'deposits' | 'staking' | 'deposits_and_staking';
  tiers: CampaignTier[];
  updatedAt?: Timestamp | FieldValue | null;
  updatedBy?: string | null;
}

export const DEFAULT_CAMPAIGN_TIERS: CampaignTier[] = [
  {
    id: 'thailand',
    name: 'Thailand Reward Trip',
    targetUsdCents: 250_000,
    nightsLabel: '4 Days • 3 Nights',
    sortOrder: 1,
  },
  {
    id: 'vietnam',
    name: 'Vietnam Reward Trip',
    targetUsdCents: 400_000,
    nightsLabel: '4 Days • 3 Nights',
    sortOrder: 2,
  },
  {
    id: 'dubai',
    name: 'Dubai Reward Trip',
    targetUsdCents: 500_000,
    nightsLabel: '4 Days • 3 Nights',
    sortOrder: 3,
  },
  {
    id: 'singapore',
    name: 'Singapore Reward Trip',
    targetUsdCents: 600_000,
    nightsLabel: '4 Days • 3 Nights',
    sortOrder: 4,
  },
];

export function defaultCampaignConfig(): DashboardCampaignConfig {
  return {
    enabled: true,
    title: 'November Mining Special Offer',
    subtitle: 'Diwali to New Year Campaign',
    bannerUrl: '/campaign-banner.jpg',
    storagePath: null,
    startsAt: null,
    endsAt: null,
    maxShows: 0,
    requiredDirectReferrals: 3,
    volumeSource: 'deposits_and_staking',
    tiers: DEFAULT_CAMPAIGN_TIERS,
    updatedAt: null,
    updatedBy: null,
  };
}

export interface CampaignUserProgress {
  userId: string;
  volumeUsdCents: number;
  directReferrals: number;
  referralsMet: boolean;
  achievedTierIds: string[];
  highestTierId: string | null;
  nextTierId: string | null;
  nextTierRemainingCents: number | null;
  status: 'not_started' | 'in_progress' | 'achieved';
  views: number;
  updatedAt?: Timestamp | FieldValue | null;
}
