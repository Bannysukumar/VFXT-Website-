import * as functionsV1 from 'firebase-functions/v1';
import { FieldValue } from 'firebase-admin/firestore';
import { Collections, getDb, initAdmin } from '../../lib/firebase';
import { allocateUniqueUserId } from '../../lib/user-id';
import { log } from '../../lib/logger';
import { UserProfile } from '../../types/models';
import { createDefaultWallets } from '../wallets/handlers';
import { maybeApplyPendingReferral } from '../referrals/handlers';

/**
 * Auth onCreate (v1) — create user profile + default wallets.
 * Prefer v1 auth triggers for reliability with Identity Platform.
 */
export const onUserCreated = functionsV1
  .region('us-central1')
  .auth.user()
  .onCreate(async (user) => {
    initAdmin();
    const db = getDb();
    const uid = user.uid;

    log.info('auth_user_created', { uid, email: user.email ?? null });

    const referralCode = await allocateUniqueUserId(db);
    const profile: UserProfile = {
      uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null,
      mobile: null,
      walletAddress: null,
      timezone: null,
      locale: null,
      preferences: {},
      status: 'active',
      kycStatus: 'none',
      referralCode,
      referredBy: null,
      binaryParentId: null,
      binarySide: null,
      binaryLeftId: null,
      binaryRightId: null,
      leftVolumeMinor: 0,
      rightVolumeMinor: 0,
      currentRank: 0,
      lastRankPaidAt: null,
      rankCycleStart: null,
      adminRole: null,
      role: 'user',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const userRef = db.collection(Collections.users).doc(uid);
    const existing = await userRef.get();
    if (!existing.exists) {
      await userRef.set(profile);
    }

    await createDefaultWallets(db, uid);

    // Referral codes passed via custom claims / metadata are applied later
    // via applyReferralCode callable; check displayName metadata hint.
    try {
      await maybeApplyPendingReferral(uid, user);
    } catch (err) {
      log.warn('referral_on_signup_failed', {
        uid,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    log.info('user_provisioned', { uid, referralCode });

    if (user.email) {
      try {
        const { sendWelcomeEmailForUser } = await import('../mail/notify');
        await sendWelcomeEmailForUser({
          userId: uid,
          email: user.email,
          displayName: user.displayName ?? null,
        });
      } catch (err) {
        log.warn('welcome_email_on_create_failed', {
          uid,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  });
