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

function generateReferralCode(uid: string): string {
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `VFXT${suffix}${rand}`.slice(0, 16);
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
      const needsProfile = !profile.mobile || !profile.referredBy;
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

const completeWalletSignupSchema = z.object({
  signupToken: z.string().min(16).max(128),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(2).max(80),
  mobile: z
    .string()
    .min(8)
    .max(20)
    .regex(/^[+0-9][0-9\s\-()]{7,19}$/),
  referralCode: z.string().min(4).max(32),
});

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

    const auth = getAuth();
    let uid: string;
    try {
      const created = await auth.createUser({
        email: parsed.data.email.trim().toLowerCase(),
        password: parsed.data.password,
        displayName: parsed.data.displayName.trim(),
        emailVerified: false,
      });
      uid = created.uid;
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

    const mobile = parsed.data.mobile.replace(/\s+/g, ' ').trim();
    if (!ready) {
      const referralCode = generateReferralCode(uid);
      const profile: UserProfile = {
        uid,
        email: parsed.data.email.trim().toLowerCase(),
        displayName: parsed.data.displayName.trim(),
        photoURL: null,
        mobile,
        walletAddress: address,
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
      await userRef.set(profile, { merge: true });
      await createDefaultWallets(db, uid);
    } else {
      await userRef.update({
        mobile,
        displayName: parsed.data.displayName.trim(),
        walletAddress: address,
        withdrawalAddress: address,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await applyCodeForUserExport(uid, parsed.data.referralCode);
    await sessionRef.delete();

    const customToken = await auth.createCustomToken(uid, {
      walletAddress: address,
      loginMethod: 'wallet',
    });

    log.info('wallet_signup_completed', { uid, address });
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
