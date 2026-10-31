import { onCall } from 'firebase-functions/v2/https';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { verifyMessage } from 'ethers';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb, initAdmin } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { log } from '../../lib/logger';
import type { UserProfile } from '../../types/models';
import { createDefaultWallets } from '../wallets/handlers';
import { applyCodeForUserExport } from '../referrals/handlers';
import {
  findWalletClaim,
  normalizeWalletAddress,
} from './wallet-ownership';
import { allocateUniqueUserId } from '../../lib/user-id';

const NONCE_TTL_MS = 10 * 60 * 1000;
const SIGNUP_TTL_MS = 30 * 60 * 1000;

function buildLoginMessage(address: string, nonce: string): string {
  return [
    'Virtual FX Trades — Sign in',
    '',
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    '',
    'This signature proves you own this wallet. It does not cost gas.',
  ].join('\n');
}

export const getWalletLoginNonce = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const parsed = z
      .object({ address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })
      .safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', 'Valid wallet address required');
    }
    const address = normalizeWalletAddress(parsed.data.address);
    const nonce = randomBytes(16).toString('hex');
    const db = getDb();
    await db.collection(Collections.config).doc(`walletNonce_${address}`).set({
      address,
      nonce,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + NONCE_TTL_MS),
    });
    const message = buildLoginMessage(address, nonce);
    return { nonce, message, address };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const verifyWalletLogin = onCall(CALLABLE_OPTS, async (request) => {
  try {
    initAdmin();
    const parsed = z
      .object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        signature: z.string().min(80).max(200),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', 'Address and signature required');
    }

    const address = normalizeWalletAddress(parsed.data.address);
    const db = getDb();
    const nonceRef = db.collection(Collections.config).doc(`walletNonce_${address}`);
    const nonceSnap = await nonceRef.get();
    if (!nonceSnap.exists) {
      throw new AppError('failed-precondition', 'Login challenge expired — try again');
    }
    const nonceData = nonceSnap.data()!;
    const expiresAt = nonceData.expiresAt as Timestamp | undefined;
    if (expiresAt && expiresAt.toMillis() < Date.now()) {
      await nonceRef.delete();
      throw new AppError('failed-precondition', 'Login challenge expired — try again');
    }
    const nonce = String(nonceData.nonce);
    const message = buildLoginMessage(address, nonce);

    let recovered: string;
    try {
      recovered = verifyMessage(message, parsed.data.signature).toLowerCase();
    } catch {
      throw new AppError('permission-denied', 'Invalid wallet signature');
    }
    if (recovered !== address) {
      throw new AppError('permission-denied', 'Signature does not match wallet');
    }

    await nonceRef.delete();

    const byWallet = await db
      .collection(Collections.users)
      .where('walletAddress', '==', address)
      .limit(1)
      .get();

    const auth = getAuth();

    if (!byWallet.empty) {
      const uid = byWallet.docs[0]!.id;
      const profile = byWallet.docs[0]!.data() as UserProfile;
      // Referral is mandatory — block dashboard until sponsor is set.
      const needsProfile = !profile.referredBy;
      const customToken = await auth.createCustomToken(uid, {
        walletAddress: address,
        loginMethod: 'wallet',
      });
      log.info('wallet_login_existing', { uid, address, needsProfile });
      return {
        customToken,
        uid,
        address,
        isNewUser: false,
        needsProfile,
        needsSignup: false,
        signupToken: null,
      };
    }

    // Not linked yet — reject if already used on another account / withdrawal.
    const claim = await findWalletClaim(db, address);
    if (claim) {
      throw new AppError(
        'already-exists',
        'This wallet is already linked to an account or used for a withdrawal. Sign in with that account.',
      );
    }

    // Verified ownership → allow signup with this wallet (do not create account yet).
    const signupToken = randomBytes(24).toString('hex');
    await db.collection(Collections.config).doc(`walletSignup_${signupToken}`).set({
      address,
      signupToken,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + SIGNUP_TTL_MS),
    });

    log.info('wallet_login_needs_signup', { address });
    return {
      customToken: null,
      uid: null,
      address,
      isNewUser: true,
      needsProfile: true,
      needsSignup: true,
      signupToken,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));
const optionalPassword = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined));

const completeWalletSignupSchema = z
  .object({
    signupToken: z.string().min(16).max(128),
    address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    /** Required — wallet signup cannot complete without a sponsor. */
    referralCode: z.string().min(4).max(32),
    email: optionalEmail,
    password: optionalPassword,
    displayName: z
      .string()
      .trim()
      .max(80)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    mobile: z
      .string()
      .trim()
      .max(20)
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email);
    const hasPassword = Boolean(data.password);
    if (hasEmail !== hasPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Email and password must both be provided, or both skipped',
        path: hasEmail ? ['password'] : ['email'],
      });
    }
    if (data.email) {
      const emailCheck = z.string().email().safeParse(data.email);
      if (!emailCheck.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a valid email',
          path: ['email'],
        });
      }
    }
    if (data.password) {
      if (data.password.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must be at least 8 characters',
          path: ['password'],
        });
      }
    }
    if (data.mobile) {
      const mobileOk = /^[+0-9][0-9\s\-()]{7,19}$/.test(data.mobile);
      if (!mobileOk || data.mobile.length < 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a valid mobile number',
          path: ['mobile'],
        });
      }
    }
    if (data.displayName && data.displayName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Name must be at least 2 characters',
        path: ['displayName'],
      });
    }
  });

async function assertReferralCodeExists(code: string): Promise<string> {
  const db = getDb();
  const normalized = code.trim().toUpperCase();
  let snap = await db
    .collection(Collections.users)
    .where('referralCode', '==', normalized)
    .limit(1)
    .get();
  if (snap.empty && code.trim() !== normalized) {
    snap = await db
      .collection(Collections.users)
      .where('referralCode', '==', code.trim())
      .limit(1)
      .get();
  }
  if (snap.empty) {
    throw new AppError('not-found', 'Referral code not found');
  }
  return (snap.docs[0]!.data().referralCode as string) || normalized;
}

/** Finish signup after wallet was verified and is not already claimed. */
export const completeWalletSignup = onCall(CALLABLE_OPTS, async (request) => {
  try {
    initAdmin();
    const parsed = completeWalletSignupSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError(
        'invalid-argument',
        parsed.error.issues[0]?.message ?? 'Invalid signup payload',
      );
    }

    const address = normalizeWalletAddress(parsed.data.address);
    const db = getDb();

    // Validate referral before creating any Auth/Firestore user.
    const referralCode = await assertReferralCodeExists(parsed.data.referralCode);

    const sessionRef = db
      .collection(Collections.config)
      .doc(`walletSignup_${parsed.data.signupToken}`);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      throw new AppError('failed-precondition', 'Wallet signup session expired — connect again');
    }
    const session = sessionSnap.data()!;
    if (normalizeWalletAddress(String(session.address)) !== address) {
      throw new AppError('permission-denied', 'Wallet does not match signup session');
    }
    const exp = session.expiresAt as Timestamp | undefined;
    if (exp && exp.toMillis() < Date.now()) {
      await sessionRef.delete();
      throw new AppError('failed-precondition', 'Wallet signup session expired — connect again');
    }

    const claim = await findWalletClaim(db, address);
    if (claim) {
      await sessionRef.delete();
      throw new AppError(
        'already-exists',
        'This wallet was claimed by another account. Connect a different wallet.',
      );
    }

    const displayName =
      parsed.data.displayName?.trim() ||
      `Wallet ${address.slice(0, 6)}…${address.slice(-4)}`;
    const mobile = parsed.data.mobile
      ? parsed.data.mobile.replace(/\s+/g, ' ').trim()
      : null;
    const email = parsed.data.email?.trim().toLowerCase() || null;
    const password = parsed.data.password;

    const auth = getAuth();
    let uid: string;
    try {
      if (email && password) {
        const created = await auth.createUser({
          email,
          password,
          displayName,
          emailVerified: false,
        });
        uid = created.uid;
      } else {
        // Wallet-only account — sign-in is via wallet signature + custom token.
        const created = await auth.createUser({
          displayName,
        });
        uid = created.uid;
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/email-already-exists') {
        throw new AppError('already-exists', 'Email is already registered — sign in instead');
      }
      throw err;
    }

    const userRef = db.collection(Collections.users).doc(uid);
    let ready = false;
    for (let i = 0; i < 12; i += 1) {
      const snap = await userRef.get();
      if (snap.exists) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!ready) {
      const ownReferralCode = await allocateUniqueUserId(db);
      const profile: UserProfile = {
        uid,
        email,
        displayName,
        photoURL: null,
        mobile,
        walletAddress: address,
        timezone: null,
        locale: null,
        preferences: {},
        status: 'active',
        kycStatus: 'none',
        referralCode: ownReferralCode,
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
      await userRef.set(profile, { merge: true });
      await createDefaultWallets(db, uid);
    } else {
      const patch: Record<string, unknown> = {
        displayName,
        walletAddress: address,
        withdrawalAddress: address,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (email) patch.email = email;
      if (mobile) patch.mobile = mobile;
      await userRef.update(patch);
    }

    try {
      await applyCodeForUserExport(uid, referralCode);
    } catch (err) {
      // Do not leave a usable session without a sponsor.
      try {
        await auth.deleteUser(uid);
      } catch {
        /* best effort */
      }
      try {
        await userRef.delete();
      } catch {
        /* best effort */
      }
      throw err;
    }

    await sessionRef.delete();

    const customToken = await auth.createCustomToken(uid, {
      walletAddress: address,
      loginMethod: 'wallet',
    });

    log.info('wallet_signup_completed', {
      uid,
      address,
      withEmail: Boolean(email),
    });
    return {
      customToken,
      uid,
      address,
      ok: true as const,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
