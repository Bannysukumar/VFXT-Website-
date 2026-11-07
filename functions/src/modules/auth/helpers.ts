import { getAuth } from 'firebase-admin/auth';
import { AuthContext } from '../../lib/permissions';
import { FeatureFlags } from '../../config/features';
import { AppError } from '../../lib/errors';
import { Collections, getDb } from '../../lib/firebase';
import { log } from '../../lib/logger';

/**
 * Gate finance ops behind email verification.
 * Token claims can stay stale after the user clicks the verify link, so we
 * fall back to Admin Auth when the JWT still says unverified.
 */
export async function gateEmailVerifiedForFinance(ctx: AuthContext): Promise<void> {
  // Wallet-only accounts (no email) skip this gate.
  if (!ctx.email) return;
  if (!FeatureFlags.requireEmailVerifiedForFinance) return;
  if (ctx.emailVerified) return;

  try {
    const record = await getAuth().getUser(ctx.uid);
    if (record.emailVerified) {
      log.info('email_verified_via_admin_auth', { uid: ctx.uid });
      return;
    }
  } catch (err) {
    log.warn('email_verified_admin_lookup_failed', {
      uid: ctx.uid,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  throw new AppError(
    'failed-precondition',
    'Email verification required. Open the link in your inbox, then refresh this page and try again.',
  );
}

export function isEmailVerified(ctx: AuthContext): boolean {
  return ctx.emailVerified === true;
}

/**
 * Block deposits / withdrawals / peer transfers / staking until
 * finalizeRegistration has set status=active and a sponsor.
 */
export async function requireActiveMember(uid: string): Promise<void> {
  const snap = await getDb().collection(Collections.users).doc(uid).get();
  if (!snap.exists) {
    throw new AppError(
      'failed-precondition',
      'Profile not ready yet — finish registration first',
    );
  }
  const data = snap.data() ?? {};
  const status = String(data.status ?? '');
  if (status === 'suspended' || status === 'closed') {
    throw new AppError('permission-denied', 'Account is not active');
  }
  if (status === 'pending_registration') {
    throw new AppError(
      'failed-precondition',
      'Complete registration with a valid referral code before using this feature',
    );
  }
  if (status !== 'active') {
    throw new AppError('permission-denied', 'Account is not active');
  }
}

/** Wait briefly for onUserCreated to write the profile doc. */
export async function waitForUserProfile(
  uid: string,
  attempts = 16,
  delayMs = 400,
): Promise<FirebaseFirestore.DocumentSnapshot> {
  const db = getDb();
  const ref = db.collection(Collections.users).doc(uid);
  for (let i = 0; i < attempts; i += 1) {
    const snap = await ref.get();
    if (snap.exists) return snap;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new AppError(
    'failed-precondition',
    'Profile not ready yet — wait a moment and try again',
  );
}

export async function assertMobileAvailable(
  mobile: string,
  exceptUid?: string,
): Promise<void> {
  const normalized = mobile.replace(/\s+/g, ' ').trim();
  if (!normalized) return;
  const snap = await getDb()
    .collection(Collections.users)
    .where('mobile', '==', normalized)
    .limit(5)
    .get();
  const clash = snap.docs.find((d) => d.id !== exceptUid);
  if (clash) {
    throw new AppError('already-exists', 'This mobile number is already in use');
  }
}
