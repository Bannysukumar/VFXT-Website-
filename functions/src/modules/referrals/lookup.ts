import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import type { UserProfile } from '../../types/models';

const schema = z.object({
  code: z.string().min(3).max(32),
});

/** Public: resolve a referral code to the upliner's display name (for register UI). */
export const lookupReferralCode = onCall(CALLABLE_OPTS, async (request) => {
  try {
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
    const name =
      (user.displayName && user.displayName.trim()) ||
      (user.email ? user.email.split('@')[0] : null) ||
      'VFXT Member';

    return {
      ok: true as const,
      referralCode: user.referralCode,
      displayName: name,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
