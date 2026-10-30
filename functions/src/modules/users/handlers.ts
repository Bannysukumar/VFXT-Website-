import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { updateProfileSchema } from './schemas';

async function handleUpdateProfile(
  request: CallableRequest,
): Promise<{ ok: true }> {
  const ctx = requireAuth(request);
  const parsed = updateProfileSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  const ref = db.collection(Collections.users).doc(ctx.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new AppError('not-found', 'User profile not found');
  }

  // Only safe client-editable fields (matches firestore.rules).
  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  const data = parsed.data;
  if (data.displayName !== undefined) patch.displayName = data.displayName;
  if (data.photoURL !== undefined) patch.photoURL = data.photoURL;
  if (data.timezone !== undefined) patch.timezone = data.timezone;
  if (data.locale !== undefined) patch.locale = data.locale;
  if (data.preferences !== undefined) patch.preferences = data.preferences;
  if (data.withdrawalAddress !== undefined) {
    patch.withdrawalAddress = data.withdrawalAddress;
  }

  await ref.update(patch);
  log.info('profile_updated', { uid: ctx.uid, fields: Object.keys(data) });
  return { ok: true };
}

export const updateProfile = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleUpdateProfile(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});
