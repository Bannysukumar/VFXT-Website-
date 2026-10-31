import { describe, expect, it } from 'vitest';
import { formatMinor, parseToMinor, rewardForElapsed } from './money';

describe('mining money', () => {
  it('parses and formats without float drift', () => {
    const minor = parseToMinor('10.5');
    expect(formatMinor(minor)).toBe('10.500000000000000000');
  });

  it('computes Reward = rate × elapsed / 3600 with floor', () => {
    const rate = parseToMinor('10'); // 10 VFXT / hour
    // 1800 seconds = half hour → 5 VFXT
    expect(formatMinor(rewardForElapsed(rate, 1800n))).toBe('5.000000000000000000');
    // 1 second → floor(10/3600)
    const oneSec = rewardForElapsed(rate, 1n);
    expect(oneSec).toBe((rate * 1n) / 3600n);
  });
});
