/**
 * Server-side feature flags. Prefer reading Firestore `/featureFlags`
 * at runtime for hot toggles; these defaults gate hard-disabled features.
 */
export const FeatureFlags: Record<
  | 'blockchain'
  | 'staking'
  | 'requireEmailVerifiedForFinance'
  | 'referralBonuses',
  boolean
> = {
  /** Blockchain / on-chain transfers — off until adapter configured. */
  blockchain: false,
  /** Staking products — VFXT daily yield + locked packages. */
  staking: true,
  /**
   * Require verified email before deposits/withdrawals.
   * Off by default: many members never complete Firebase email links (custom-domain
   * action URLs without /auth/action handler left emailVerified=false forever).
   * Soft verify prompts remain in the app; turn this on after action links work.
   */
  requireEmailVerifiedForFinance: false,
  /** Referral bonuses auto-credit on stake. */
  referralBonuses: true,
};

export type FeatureFlagName = keyof typeof FeatureFlags;

export function isFeatureEnabled(name: FeatureFlagName): boolean {
  return FeatureFlags[name] === true;
}
