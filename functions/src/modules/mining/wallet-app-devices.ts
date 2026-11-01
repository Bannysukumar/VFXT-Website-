import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { requireAuth } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { writeAuditLog } from '../audit/handlers';

/** users/{uid}/walletDevices/{installId} — one doc per Android install, written only by these callables. */
const DEVICES = 'walletDevices';

const installIdSchema = z.string().regex(/^[a-zA-Z0-9-]{16,64}$/);

const registerSchema = z.object({
  installId: installIdSchema,
  model: z.string().trim().max(80).default('Android device'),
  osVersion: z.string().trim().max(20).default(''),
  appVersion: z.string().trim().max(20).default(''),
});

function devicesRef(uid: string) {
  return getDb().collection(Collections.users).doc(uid).collection(DEVICES);
}

function millis(value: unknown): number | null {
  return value instanceof Timestamp ? value.toMillis() : null;
}

/** True when this install was signed out from another device; used by wallet login to refuse it. */
export async function isWalletDeviceRevoked(uid: string, installId: string | undefined): Promise<boolean> {
  if (!installId || !installIdSchema.safeParse(installId).success) return false;
  const snap = await devicesRef(uid).doc(installId).get();
  return snap.exists && snap.data()?.status === 'revoked';
}

/**
 * Records (or refreshes) the calling install. Returns `revoked: true` when this install was signed
 * out remotely, so the app can drop its still-valid ID token right away instead of waiting for expiry.
 */
export const registerWalletDevice = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const { uid } = requireAuth(request);
    const parsed = registerSchema.safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid device details');
    const { installId, model, osVersion, appVersion } = parsed.data;

    const ref = devicesRef(uid).doc(installId);
    const snap = await ref.get();
    if (snap.exists && snap.data()?.status === 'revoked') {
      return { revoked: true };
    }
    await ref.set(
      {
        installId,
        model,
        osVersion,
        appVersion,
        status: 'active',
        lastSeenAt: FieldValue.serverTimestamp(),
        ...(snap.exists ? {} : { firstSeenAt: FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );
    return { revoked: false };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Active installs signed in to the caller's wallet account, most recent first. */
export const listWalletDevices = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const { uid } = requireAuth(request);
    const snap = await devicesRef(uid).where('status', '==', 'active').get();
    const devices = snap.docs
      .map((doc) => {
        const d = doc.data();
        return {
          installId: doc.id,
          model: String(d.model ?? 'Android device'),
          osVersion: String(d.osVersion ?? ''),
          appVersion: String(d.appVersion ?? ''),
          firstSeenAt: millis(d.firstSeenAt),
          lastSeenAt: millis(d.lastSeenAt),
        };
      })
      .sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
    return { devices };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/**
 * Signs out every install except the caller's. Revokes all refresh tokens for the account (the caller
 * re-authenticates with a fresh wallet signature afterwards) and marks the other installs revoked so
 * they cannot sign back in silently.
 */
export const signOutOtherWalletDevices = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const { uid } = requireAuth(request);
    const parsed = z.object({ installId: installIdSchema }).safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Install id required');
    const keep = parsed.data.installId;

    const snap = await devicesRef(uid).where('status', '==', 'active').get();
    const others = snap.docs.filter((doc) => doc.id !== keep);
    const batch = getDb().batch();
    for (const doc of others) {
      batch.update(doc.ref, { status: 'revoked', revokedAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
    await getAuth().revokeRefreshTokens(uid);

    await writeAuditLog({
      actorId: uid,
      action: 'wallet_app_sign_out_other_devices',
      resourceType: 'user',
      resourceId: uid,
      metadata: { keptInstallId: keep, revokedCount: others.length },
      ip: request.rawRequest?.ip ?? null,
    });
    log.info('wallet_app_sign_out_other_devices', { uid, revoked: others.length });
    return { revokedCount: others.length };
  } catch (err) {
    throw toHttpsError(err);
  }
});
