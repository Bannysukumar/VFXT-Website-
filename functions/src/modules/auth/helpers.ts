import { AuthContext, requireEmailVerified } from '../../lib/permissions';
import { FeatureFlags } from '../../config/features';
import { AppError } from '../../lib/errors';
import { Collections, getDb } from '../../lib/firebase';

/** Optionally gate finance ops behind email verification. */
export function gateEmailVerifiedForFinance(ctx: AuthContext): void {
  // Wallet-only accounts (no email) skip this gate.
  if (!ctx.email) return;
  if (FeatureFlags.requireEmailVerifiedForFinance) {
    requireEmailVerified(ctx);
  }
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
