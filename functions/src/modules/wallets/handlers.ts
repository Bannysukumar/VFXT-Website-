import { FieldValue, Firestore } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  ALLOWED_TRANSFERS,
  isTransferAllowed,
  WalletKind,
  WALLET_CURRENCY,
} from '../../config/plan';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  buildIdempotencyKey,
  claimIdempotencyKey,
} from '../../lib/idempotency';
import { assertPositiveMinor } from '../../lib/money';
import { requireAuth } from '../../lib/permissions';
import { WalletDoc } from '../../types/models';
import { DEFAULT_WALLETS, walletDocId } from './types';

/**
 * Create any missing plan wallets for a user (idempotent).
 * Does not overwrite existing balances.
 */
export async function ensureUserWallets(
  db: Firestore,
  userId: string,
): Promise<{ created: string[]; wallets: WalletDoc[] }> {
  const created: string[] = [];
  const wallets: WalletDoc[] = [];
  const batch = db.batch();
  let writes = 0;

  for (const def of DEFAULT_WALLETS) {
    const walletId = walletDocId(userId, def.kind);
    const ref = db.collection(Collections.wallets).doc(walletId);
    const snap = await ref.get();
    if (snap.exists) {
      const existing = snap.data() as WalletDoc;
      // Keep metadata aligned with tokens-only plan (balances migrated separately).
      if (existing.currency !== def.currency || existing.decimals !== def.decimals) {
        batch.update(ref, {
          currency: def.currency,
          decimals: def.decimals,
          kind: def.kind,
          updatedAt: FieldValue.serverTimestamp(),
        });
        writes += 1;
        wallets.push({ ...existing, currency: def.currency, decimals: def.decimals, kind: def.kind });
      } else {
        wallets.push(existing);
      }
      continue;
    }

    const doc: WalletDoc = {
      walletId,
      userId,
      kind: def.kind,
      currency: def.currency,
      availableMinor: 0,
      reservedMinor: 0,
      decimals: def.decimals,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    batch.set(ref, doc, { merge: false });
    created.push(def.kind);
    wallets.push(doc);
    writes += 1;
  }

  if (writes > 0) {
    await batch.commit();
  }
  return { created, wallets };
}

/** Create default multi-wallets for a new user (idempotent). */
export async function createDefaultWallets(
  db: Firestore,
  userId: string,
): Promise<WalletDoc[]> {
  const { wallets } = await ensureUserWallets(db, userId);
  return wallets;
}

export async function getUserWallet(
  db: Firestore,
  userId: string,
  kind: WalletKind,
): Promise<WalletDoc | null> {
  const snap = await db
    .collection(Collections.wallets)
    .doc(walletDocId(userId, kind))
    .get();
  if (!snap.exists) return null;
  return snap.data() as WalletDoc;
}

export const ensureWallets = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const { requireActiveMember } = await import('../auth/helpers');
    await requireActiveMember(ctx.uid);
    const db = getDb();
    const { created } = await ensureUserWallets(db, ctx.uid);
    return { created };
  } catch (err) {
    throw toHttpsError(err);
  }
});

const transferSchema = z
  .object({
    fromKind: z.enum([
      'fund',
      'staking',
      'daily_roi',
      'level_income',
      'direct_referral',
      'withdrawal',
      'vfxt',
    ]),
    toKind: z.enum([
      'fund',
      'staking',
      'daily_roi',
      'level_income',
      'direct_referral',
      'withdrawal',
      'vfxt',
    ]),
    amountMinor: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();

/**
 * Server-validated wallet transfers (all VFXT → VFXT, 1:1).
 * Allowed: daily_roi→withdrawal, level_income→withdrawal,
 * direct_referral→staking|withdrawal.
 */
export const transferBetweenWallets = onCall(
  CALLABLE_OPTS,
  async (request) => {
    try {
      const ctx = requireAuth(request);
      const { requireActiveMember } = await import('../auth/helpers');
      await requireActiveMember(ctx.uid);
      const parsed = transferSchema.safeParse(request.data);
      if (!parsed.success) {
        throw new AppError('invalid-argument', parsed.error.message);
      }

      const { fromKind, toKind, amountMinor, idempotencyKey } = parsed.data;
      if (!isTransferAllowed(fromKind, toKind)) {
        throw new AppError(
          'failed-precondition',
          `Transfer ${fromKind} → ${toKind} is not allowed`,
          { allowed: ALLOWED_TRANSFERS },
        );
      }
      assertPositiveMinor(amountMinor);

      const db = getDb();
      await ensureUserWallets(db, ctx.uid);

      const fromCurrency = WALLET_CURRENCY[fromKind];
      const toCurrency = WALLET_CURRENCY[toKind];
      const fromWalletId = walletDocId(ctx.uid, fromKind);
      const toWalletId = walletDocId(ctx.uid, toKind);

      // Tokens-only ledger: transfers are always 1:1 VFXT.
      const creditAmount = amountMinor;

      if (creditAmount <= 0) {
        throw new AppError(
          'invalid-argument',
          'Credit amount must be positive',
        );
      }

      const key =
        idempotencyKey ||
        buildIdempotencyKey(
          'wallet.transfer',
          `${fromKind}:${toKind}:${amountMinor}`,
          ctx.uid,
        );

      await db.runTransaction(async (tx) => {
        await claimIdempotencyKey(
          tx,
          db,
          key,
          'wallet.transfer',
          ctx.uid,
          `${fromWalletId}->${toWalletId}`,
        );

        const { applyLedgerEntries } = await import('./ledger');
        await applyLedgerEntries(tx, db, [
          {
            userId: ctx.uid,
            walletId: fromWalletId,
            type: 'wallet_transfer',
            direction: 'debit',
            amountMinor,
            availableDelta: -amountMinor,
            reservedDelta: 0,
            currency: fromCurrency,
            referenceType: 'wallet_transfer',
            referenceId: key,
            description: `Transfer ${fromKind} → ${toKind}`,
            createdBy: ctx.uid,
            metadata: { fromKind, toKind, creditAmount },
          },
          {
            userId: ctx.uid,
            walletId: toWalletId,
            type: 'wallet_transfer',
            direction: 'credit',
            amountMinor: creditAmount,
            availableDelta: creditAmount,
            reservedDelta: 0,
            currency: toCurrency,
            referenceType: 'wallet_transfer',
            referenceId: key,
            description: `Transfer ${fromKind} → ${toKind}`,
            createdBy: ctx.uid,
            metadata: { fromKind, toKind, debitAmount: amountMinor },
          },
        ]);
      });

      return { ok: true as const };
    } catch (err) {
      throw toHttpsError(err);
    }
  },
);
