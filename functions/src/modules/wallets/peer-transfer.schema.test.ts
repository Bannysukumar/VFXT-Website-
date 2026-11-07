import { describe, expect, it } from 'vitest';
import { transferToUserSchema } from './peer-transfer.schemas';

describe('transferToUserSchema', () => {
  const base = {
    toUserId: 'VFXT2533',
    walletKind: 'daily_roi' as const,
    amountMinor: 1000,
    idempotencyKey: 'test-key-12345678',
  };

  it('accepts a transfer with no note field', () => {
    const parsed = transferToUserSchema.safeParse(base);
    expect(parsed.success).toBe(true);
  });

  it('accepts note: null from Firebase callable encoding', () => {
    const parsed = transferToUserSchema.safeParse({ ...base, note: null });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.note).toBeNull();
    }
  });

  it('accepts a normal note string', () => {
    const parsed = transferToUserSchema.safeParse({
      ...base,
      note: 'birthday gift',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejects the old optional-only failure mode message for required strings', () => {
    const parsed = transferToUserSchema.safeParse({
      ...base,
      toUserId: null,
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues[0]?.message).toMatch(/Expected string, received null/);
    }
  });
});
