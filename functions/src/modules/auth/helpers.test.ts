import { describe, expect, it } from 'vitest';
import { FeatureFlags } from '../../config/features';
import { gateEmailVerifiedForFinance } from './helpers';

describe('FeatureFlags.requireEmailVerifiedForFinance', () => {
  it('stays off so unverified members can deposit', () => {
    expect(FeatureFlags.requireEmailVerifiedForFinance).toBe(false);
  });
});

describe('gateEmailVerifiedForFinance', () => {
  it('does not block unverified email when the finance gate is disabled', async () => {
    await expect(
      gateEmailVerifiedForFinance({
        uid: 'unverified-user',
        email: 'member@example.com',
        emailVerified: false,
        adminRole: null,
        token: {},
      }),
    ).resolves.toBeUndefined();
  });

  it('skips wallet-only accounts with no email', async () => {
    await expect(
      gateEmailVerifiedForFinance({
        uid: 'wallet-only',
        emailVerified: false,
        adminRole: null,
        token: {},
      }),
    ).resolves.toBeUndefined();
  });

  it('allows already-verified emails', async () => {
    await expect(
      gateEmailVerifiedForFinance({
        uid: 'verified-user',
        email: 'ok@example.com',
        emailVerified: true,
        adminRole: null,
        token: {},
      }),
    ).resolves.toBeUndefined();
  });
});
