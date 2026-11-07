import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import type { UserProfile } from '../../types/models';
import { assertRateLimit, rateLimitKey } from '../../lib/rate-limit';

const schema = z.object({
  code: z.string().min(3).max(32),
});

/**
 * Public: validate a referral code for the register UI.
 * Returns the code only (no display name) to reduce user enumeration.
 */
export const lookupReferralCode = onCall(CALLABLE_OPTS, async (request) => {
  try {
    assertRateLimit(rateLimitKey(request, 'referral.lookup'), 20, 60_000);

    const parsed = schema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', 'Referral code required');
    }
    const normalized = parsed.data.code.trim().toUpperCase();
    const db = getDb();

    let snap = await db
      .collection(Collections.users)
      .where('referralCode', '==', normalized)
      .limit(1)
      .get();

    if (snap.empty) {
      snap = await db
        .collection(Collections.users)
        .where('referralCode', '==', parsed.data.code.trim())
        .limit(1)
        .get();
    }

    if (snap.empty) {
      throw new AppError('not-found', 'Referral code not found');
    }

    const user = snap.docs[0]!.data() as UserProfile;
    // Only fully activated accounts can sponsor (blocks pending_registration stubs).
    if (user.status !== 'active') {
      throw new AppError('not-found', 'Referral code not found');
    }

    return {
      ok: true as const,
      referralCode: user.referralCode,
      valid: true as const,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
