import { describe, expect, it, vi, beforeEach } from 'vitest';
import { WalletDoc } from '../../types/models';

/**
 * Unit-test appendLedgerEntry balance math with a minimal Firestore
 * transaction mock — no emulator required.
 */

type MockDoc = { exists: boolean; data: () => unknown };

function createMockTx(wallet: WalletDoc) {
  const writes: Array<{ type: string; ref: string; data: unknown }> = [];
  let current = { ...wallet };

  const tx = {
    get: vi.fn(async (_ref: { path: string }) => {
      return {
        exists: true,
        data: () => current,
      } as MockDoc;
    }),
    set: vi.fn((ref: { path: string }, data: unknown) => {
      writes.push({ type: 'set', ref: ref.path, data });
    }),
    update: vi.fn((ref: { path: string }, data: Record<string, unknown>) => {
      current = {
        ...current,
        availableMinor: data.availableMinor as number,
        reservedMinor: data.reservedMinor as number,
      };
      writes.push({ type: 'update', ref: ref.path, data });
    }),
  };

  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({
        path: `${name}/${id}`,
        id,
      }),
    }),
  };

  return { tx, db, writes, getWallet: () => current };
}

describe('appendLedgerEntry (mocked transaction)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('credits available balance and records ledger entry', async () => {
    const { appendLedgerEntry } = await import('./ledger');
    const wallet: WalletDoc = {
      walletId: 'u1_fund',
      userId: 'u1',
      kind: 'fund',
      currency: 'USD',
      availableMinor: 1000,
      reservedMinor: 0,
      decimals: 2,
      createdAt: null as unknown as WalletDoc['createdAt'],
      updatedAt: null as unknown as WalletDoc['updatedAt'],
    };

    const { tx, db, writes, getWallet } = createMockTx(wallet);

    const result = await appendLedgerEntry(
      tx as never,
      db as never,
      {
        userId: 'u1',
        walletId: 'u1_fund',
        type: 'deposit_credit',
        direction: 'credit',
        amountMinor: 500,
        currency: 'USD',
        referenceType: 'deposit',
        referenceId: 'd1',
        description: 'test credit',
        createdBy: 'admin1',
        availableDelta: 500,
        reservedDelta: 0,
      },
    );

    expect(result.wallet.availableMinor).toBe(1500);
    expect(result.wallet.reservedMinor).toBe(0);
    expect(getWallet().availableMinor).toBe(1500);
    expect(writes.some((w) => w.type === 'set')).toBe(true);
    expect(writes.some((w) => w.type === 'update')).toBe(true);
  });

  it('reserves funds by moving available → reserved', async () => {
    const { reserveFunds } = await import('./ledger');
    const wallet: WalletDoc = {
      walletId: 'u1_withdrawal',
      userId: 'u1',
      kind: 'withdrawal',
      currency: 'USD',
      availableMinor: 2000,
      reservedMinor: 0,
      decimals: 2,
      createdAt: null as unknown as WalletDoc['createdAt'],
      updatedAt: null as unknown as WalletDoc['updatedAt'],
    };

    const { tx, db, getWallet } = createMockTx(wallet);

    await reserveFunds(tx as never, db as never, {
      userId: 'u1',
      walletId: 'u1_withdrawal',
      type: 'withdrawal_reserve',
      amountMinor: 750,
      currency: 'USD',
      referenceType: 'withdrawal',
      referenceId: 'w1',
      description: 'reserve',
      createdBy: 'u1',
    });

    expect(getWallet().availableMinor).toBe(1250);
    expect(getWallet().reservedMinor).toBe(750);
  });

  it('rejects insufficient balance', async () => {
    const { reserveFunds } = await import('./ledger');
    const wallet: WalletDoc = {
      walletId: 'u1_withdrawal',
      userId: 'u1',
      kind: 'withdrawal',
      currency: 'USD',
      availableMinor: 100,
      reservedMinor: 0,
      decimals: 2,
      createdAt: null as unknown as WalletDoc['createdAt'],
      updatedAt: null as unknown as WalletDoc['updatedAt'],
    };

    const { tx, db } = createMockTx(wallet);

    await expect(
      reserveFunds(tx as never, db as never, {
        userId: 'u1',
        walletId: 'u1_withdrawal',
        type: 'withdrawal_reserve',
        amountMinor: 500,
        currency: 'USD',
        referenceType: 'withdrawal',
        referenceId: 'w1',
        description: 'reserve',
        createdBy: 'u1',
      }),
    ).rejects.toMatchObject({ code: 'insufficient-balance' });
  });

  it('rejects non-integer wallet balances', async () => {
    const { appendLedgerEntry } = await import('./ledger');
    const wallet = {
      walletId: 'u1_fund',
      userId: 'u1',
      kind: 'fund',
      currency: 'USD',
      availableMinor: 10.5,
      reservedMinor: 0,
      decimals: 2,
      createdAt: null,
      updatedAt: null,
    } as unknown as WalletDoc;

    const { tx, db } = createMockTx(wallet);

    await expect(
      appendLedgerEntry(tx as never, db as never, {
        userId: 'u1',
        walletId: 'u1_fund',
        type: 'deposit_credit',
        direction: 'credit',
        amountMinor: 1,
        currency: 'USD',
        referenceType: 'deposit',
        referenceId: 'd1',
        description: 'bad',
        createdBy: 'admin',
        availableDelta: 1,
        reservedDelta: 0,
      }),
    ).rejects.toMatchObject({ code: 'failed-precondition' });
  });
});
