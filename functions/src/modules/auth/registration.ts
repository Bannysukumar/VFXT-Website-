import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { applyCodeForUserExport } from '../referrals/handlers';

const bep20 = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid BEP-20 wallet address')
  .optional()
  .or(z.literal(''));

const finalizeSchema = z.object({
  referralCode: z.string().min(4).max(32),
  mobile: z
    .string()
    .min(8, 'Mobile number required')
    .max(20)
    .regex(/^[+0-9][0-9\s\-()]{7,19}$/, 'Enter a valid mobile number'),
  displayName: z.string().min(2).max(80).optional(),
  walletAddress: bep20,
});

/**
 * After email/password or wallet signup: set mobile, optional wallet, mandatory referral.
 */
export const finalizeRegistration = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const parsed = finalizeSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { referralCode, mobile, displayName } = parsed.data;
    const walletRaw = parsed.data.walletAddress?.trim() || '';
    const walletAddress = walletRaw ? walletRaw.toLowerCase() : null;

    const db = getDb();
    const ref = db.collection(Collections.users).doc(ctx.uid);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new AppError(
        'failed-precondition',
        'Profile not ready yet — wait a moment and try again',
      );
    }

    if (walletAddress) {
      const { findWalletClaim } = await import('./wallet-ownership');
      const claim = await findWalletClaim(db, walletAddress, ctx.uid);
      if (claim) {
        throw new AppError(
          'already-exists',
          'This wallet is already linked to another account or used for a withdrawal',
        );
      }
    }

    const patch: Record<string, unknown> = {
      mobile: mobile.replace(/\s+/g, ' ').trim(),
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (displayName) patch.displayName = displayName.trim();
    if (walletAddress) {
      patch.walletAddress = walletAddress;
      patch.withdrawalAddress = walletAddress;
    }

    await ref.update(patch);

    const profile = (await ref.get()).data()!;
    let referrerId: string;
    if (!profile.referredBy) {
      const referral = await applyCodeForUserExport(ctx.uid, referralCode);
      referrerId = referral.referrerId;
    } else {
      referrerId = profile.referredBy as string;
    }

    log.info('registration_finalized', {
      uid: ctx.uid,
      referrerId,
      hasWallet: Boolean(walletAddress),
    });

    return {
      ok: true as const,
      referrerId,
      mobile: patch.mobile as string,
      walletAddress,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
