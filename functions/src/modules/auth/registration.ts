import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { applyCodeForUserExport } from '../referrals/handlers';
import {
  assertMobileAvailable,
  waitForUserProfile,
} from './helpers';

const bep20 = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid BEP-20 wallet address')
  .optional()
  .or(z.literal(''));

const finalizeSchema = z.object({
  referralCode: z.string().min(4).max(32),
  mobile: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || v.trim() === '' || /^[+0-9][0-9\s\-()]{7,19}$/.test(v), {
      message: 'Enter a valid mobile number',
    }),
  displayName: z.string().max(80).optional().or(z.literal('')),
  walletAddress: bep20,
});

/**
 * After email/password or wallet signup: mandatory referral; mobile/wallet optional.
 * Activates the account (status → active) only after a sponsor is attached.
 */
export const finalizeRegistration = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    const parsed = finalizeSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid input');
    }

    const { referralCode, displayName } = parsed.data;
    const mobileRaw = parsed.data.mobile?.trim() || '';
    const walletRaw = parsed.data.walletAddress?.trim() || '';
    const walletAddress = walletRaw ? walletRaw.toLowerCase() : null;

    const db = getDb();
    const ref = db.collection(Collections.users).doc(ctx.uid);
    // Wait for onUserCreated instead of failing immediately on cold starts.
    await waitForUserProfile(ctx.uid);

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

    const mobileNormalized = mobileRaw ? mobileRaw.replace(/\s+/g, ' ').trim() : '';
    if (mobileNormalized) {
      await assertMobileAvailable(mobileNormalized, ctx.uid);
    }

    const patch: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (mobileNormalized) patch.mobile = mobileNormalized;
    if (displayName?.trim()) patch.displayName = displayName.trim();
    if (walletAddress) {
      patch.walletAddress = walletAddress;
      patch.withdrawalAddress = walletAddress;
    }

    if (Object.keys(patch).length > 1) {
      await ref.update(patch);
    }

    const profile = (await ref.get()).data()!;
    let referrerId: string;
    if (!profile.referredBy) {
      const referral = await applyCodeForUserExport(ctx.uid, referralCode);
      referrerId = referral.referrerId;
    } else {
      referrerId = profile.referredBy as string;
    }

    // Activate only after sponsor is attached.
    await ref.update({
      status: 'active',
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (ctx.email || profile.email) {
      try {
        const { sendWelcomeEmailForUser } = await import('../mail/notify');
        await sendWelcomeEmailForUser({
          userId: ctx.uid,
          email: (ctx.email ?? profile.email) as string,
          displayName:
            (patch.displayName as string | undefined) ??
            (profile.displayName as string | null) ??
            null,
        });
      } catch (err) {
        log.warn('welcome_email_on_finalize_failed', {
          uid: ctx.uid,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    log.info('registration_finalized', {
      uid: ctx.uid,
      referrerId,
      hasWallet: Boolean(walletAddress),
      status: 'active',
    });

    return {
      ok: true as const,
      referrerId,
      mobile: (patch.mobile as string | undefined) ?? (profile.mobile as string | null) ?? null,
      walletAddress,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
