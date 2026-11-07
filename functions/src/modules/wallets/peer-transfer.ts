import { onCall } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { WALLET_CURRENCY, type WalletKind } from '../../config/plan';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  buildIdempotencyKey,
  claimIdempotencyKey,
} from '../../lib/idempotency';
import { assertPositiveMinor } from '../../lib/money';
import { requireAuth } from '../../lib/permissions';
import { normalizeUserId } from '../../lib/user-id';
import { ensureUserWallets } from './handlers';
import { walletDocId } from './types';

/** Schema accepts any wallet kind; admin transfer settings decide what is allowed. */
const transferToUserSchema = z
  .object({
    toUserId: z.string().min(4).max(32),
    walletKind: z.enum([
      'fund',
      'staking',
      'daily_roi',
      'level_income',
      'direct_referral',
      'withdrawal',
      'vfxt',
    ]),
    amountMinor: z.number().int().positive(),
    note: z.string().max(200).optional(),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();

async function findUserByPublicId(
  db: Firestore,
  publicId: string,
): Promise<{
  uid: string;
  referralCode: string;
  displayName: string | null;
  status: string;
}> {
  const code = normalizeUserId(publicId);
  let snap = await db
    .collection(Collections.users)
    .where('referralCode', '==', code)
    .limit(1)
    .get();
  if (snap.empty) {
    snap = await db
      .collection(Collections.users)
      .where('referralCode', '==', publicId.trim())
      .limit(1)
      .get();
  }
  if (snap.empty) {
    throw new AppError('not-found', `No user found with ID ${code}`);
  }
  const doc = snap.docs[0]!;
  const data = doc.data();
  if (data.status === 'suspended' || data.status === 'closed') {
    throw new AppError('failed-precondition', 'Recipient account is not active');
  }
  return {
    uid: doc.id,
    referralCode: String(data.referralCode ?? code),
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    status: String(data.status ?? ''),
  };
}

/**
 * P2P transfer by public user id (referralCode, e.g. VFXT2533).
 * Allowed wallets: fund, vfxt, withdrawal, and direct_referral (all VFXT, same-kind credit).
 */
export const transferToUser = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const { requireActiveMember } = await import('../auth/helpers');
    await requireActiveMember(ctx.uid);
    const parsed = transferToUserSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError(
        'invalid-argument',
        parsed.error.issues[0]?.message ?? 'Invalid transfer payload',
      );
    }

    const { toUserId, walletKind, amountMinor, note, idempotencyKey } = parsed.data;
    assertPositiveMinor(amountMinor);

    const { assertPeerTransferAllowed } = await import('./transfer-settings');
    await assertPeerTransferAllowed(walletKind);

    const db = getDb();
    const recipient = await findUserByPublicId(db, toUserId);
    if (recipient.uid === ctx.uid) {
      throw new AppError('invalid-argument', 'Cannot transfer to yourself');
    }

    const senderSnap = await db.collection(Collections.users).doc(ctx.uid).get();
    if (!senderSnap.exists) {
      throw new AppError('not-found', 'Sender profile not found');
    }
    const senderCode = String(senderSnap.data()?.referralCode ?? ctx.uid);
    if (senderSnap.data()?.status === 'suspended' || senderSnap.data()?.status === 'closed') {
      throw new AppError('failed-precondition', 'Your account cannot send transfers');
    }

    await ensureUserWallets(db, ctx.uid);
    await ensureUserWallets(db, recipient.uid);

    const currency = WALLET_CURRENCY[walletKind as WalletKind];
    const fromWalletId = walletDocId(ctx.uid, walletKind);
    const toWalletId = walletDocId(recipient.uid, walletKind);
    const key =
      idempotencyKey ||
      buildIdempotencyKey('peer.transfer', `${walletKind}:${amountMinor}:${recipient.uid}`, ctx.uid);

    const noteText = note?.trim() || undefined;
    const descOut = `Transfer to ${recipient.referralCode}`;
    const descIn = `Transfer from ${senderCode}`;

    await db.runTransaction(async (tx) => {
      await claimIdempotencyKey(tx, db, key, 'peer.transfer', ctx.uid, toWalletId);

      const { applyLedgerEntries } = await import('./ledger');
      await applyLedgerEntries(tx, db, [
        {
          userId: ctx.uid,
          walletId: fromWalletId,
          type: 'peer_transfer',
          direction: 'debit',
          amountMinor,
          availableDelta: -amountMinor,
          reservedDelta: 0,
          currency,
          referenceType: 'peer_transfer',
          referenceId: key,
          description: descOut,
          createdBy: ctx.uid,
          metadata: {
            counterpartyUid: recipient.uid,
            counterpartyUserId: recipient.referralCode,
            counterpartyName: recipient.displayName,
            fromUserId: senderCode,
            toUserId: recipient.referralCode,
            walletKind,
            note: noteText ?? null,
            side: 'out',
          },
        },
        {
          userId: recipient.uid,
          walletId: toWalletId,
          type: 'peer_transfer',
          direction: 'credit',
          amountMinor,
          availableDelta: amountMinor,
          reservedDelta: 0,
          currency,
          referenceType: 'peer_transfer',
          referenceId: key,
          description: descIn,
          createdBy: ctx.uid,
          metadata: {
            counterpartyUid: ctx.uid,
            counterpartyUserId: senderCode,
            fromUserId: senderCode,
            toUserId: recipient.referralCode,
            walletKind,
            note: noteText ?? null,
            side: 'in',
          },
        },
      ]);
    });

    return {
      ok: true as const,
      toUserId: recipient.referralCode,
      toUid: recipient.uid,
      walletKind,
      amountMinor,
      currency,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Resolve a public user id for transfer UI (minimal leakage). */
export const lookupUserId = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const { assertRateLimit, rateLimitKey } = await import('../../lib/rate-limit');
    const { requireActiveMember } = await import('../auth/helpers');
    assertRateLimit(rateLimitKey(request, 'user.lookup'), 20, 60_000);
    await requireActiveMember(ctx.uid);
    const raw = z.string().min(4).max(32).parse((request.data as { userId?: string })?.userId);
    const db = getDb();
    const user = await findUserByPublicId(db, raw);
    if (user.status !== 'active') {
      throw new AppError('not-found', 'User not found');
    }
    const name = String(user.displayName ?? '').trim();
    const masked =
      name.length <= 1 ? 'Member' : `${name.slice(0, 1)}${'*'.repeat(Math.min(6, name.length - 1))}`;
    return {
      userId: user.referralCode,
      valid: true as const,
      displayName: masked,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
