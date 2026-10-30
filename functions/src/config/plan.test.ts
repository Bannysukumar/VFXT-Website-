import { describe, expect, it } from 'vitest';
import {
  dailyYieldCents,
  directReferralBonusTokens,
  isLevelUnlocked,
  isTransferAllowed,
  levelCommissionCents,
  lockedMaturityPayout,
  nextDailyYieldCents,
  payoutCapCents,
  qualifiedRank,
  shouldStopDailyYield,
  usdCentsToVfxtTokens,
  vfxtTokensToUsdCents,
} from './plan';

describe('VFXT plan math', () => {
  it('converts USD cents to whole VFXT tokens ($1 = 10_000 VFXT)', () => {
    expect(usdCentsToVfxtTokens(100)).toBe(10_000);
    expect(usdCentsToVfxtTokens(10_000)).toBe(1_000_000);
    expect(vfxtTokensToUsdCents(10_000)).toBe(100);
  });

  it('computes 1% daily yield in cents', () => {
    expect(dailyYieldCents(10_000)).toBe(100);
    expect(dailyYieldCents(12_345)).toBe(123);
  });

  it('applies 2X / 3X payout caps', () => {
    expect(payoutCapCents(10_000, false)).toBe(20_000);
    expect(payoutCapCents(10_000, true)).toBe(30_000);
  });

  it('stops daily yield at 200 days or cap', () => {
    expect(
      shouldStopDailyYield({
        daysPaid: 200,
        totalPaidMinor: 0,
        capMinor: 20_000,
      }),
    ).toBe(true);
    expect(
      shouldStopDailyYield({
        daysPaid: 10,
        totalPaidMinor: 20_000,
        capMinor: 20_000,
      }),
    ).toBe(true);
    expect(
      nextDailyYieldCents({
        principalCents: 10_000,
        daysPaid: 199,
        totalPaidMinor: 19_950,
        capMinor: 20_000,
      }),
    ).toBe(50);
  });

  it('computes 7-level commissions on capital', () => {
    // L1 0.50% of $100 = 50 cents
    expect(levelCommissionCents(10_000, 1)).toBe(50);
    expect(levelCommissionCents(10_000, 3)).toBe(25);
    expect(levelCommissionCents(10_000, 7)).toBe(10);
  });

  it('unlocks level N only with ≥ N directs', () => {
    expect(isLevelUnlocked(0, 1)).toBe(false);
    expect(isLevelUnlocked(1, 1)).toBe(true);
    expect(isLevelUnlocked(3, 4)).toBe(false);
    expect(isLevelUnlocked(7, 7)).toBe(true);
  });

  it('credits 5% direct referral as VFXT tokens', () => {
    // 5% of $100 = $5 = 500 cents → 50_000 VFXT
    expect(directReferralBonusTokens(10_000)).toBe(50_000);
  });

  it('computes locked maturity USD + VFXT bonus', () => {
    const payout = lockedMaturityPayout({
      principalCents: 10_000,
      multiplier: 3,
      bonusTokenPct: 50,
    });
    expect(payout.usdCreditCents).toBe(30_000);
    // 1_000_000 tokens * 50% = 500_000
    expect(payout.bonusVfxtTokens).toBe(500_000);
  });

  it('qualifies binary ranks from left/right volume', () => {
    expect(qualifiedRank(50_000, 50_000)).toBe(0);
    expect(qualifiedRank(100_000, 100_000)).toBe(1);
    expect(qualifiedRank(500_000, 500_000)).toBe(3);
    expect(qualifiedRank(10_000_000, 10_000_000)).toBe(9);
  });

  it('allows only documented wallet transfer routes', () => {
    expect(isTransferAllowed('daily_roi', 'withdrawal')).toBe(true);
    expect(isTransferAllowed('fund', 'staking')).toBe(false);
    expect(isTransferAllowed('direct_referral', 'staking')).toBe(true);
  });
});
