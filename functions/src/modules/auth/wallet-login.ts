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

const NONCE_TTL_MS = 10 * 60 * 1000;

function normalizeAddress(addr: string): string {
  return addr.trim().toLowerCase();
}

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
    const address = normalizeAddress(parsed.data.address);
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

    const address = normalizeAddress(parsed.data.address);
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

    // Find existing profile by wallet
    let uid: string | null = null;
    const byWallet = await db
      .collection(Collections.users)
      .where('walletAddress', '==', address)
      .limit(1)
      .get();
    if (!byWallet.empty) {
      uid = byWallet.docs[0]!.id;
    }

    const auth = getAuth();
    let isNewUser = false;
    let needsProfile = false;

    if (!uid) {
      // Create Firebase Auth user; onUserCreated provisions profile + wallets.
      const created = await auth.createUser({
        displayName: `${address.slice(0, 6)}…${address.slice(-4)}`,
      });
      uid = created.uid;
      isNewUser = true;

      const userRef = db.collection(Collections.users).doc(uid);
      let ready = false;
      for (let i = 0; i < 12; i += 1) {
        const snap = await userRef.get();
        if (snap.exists) {
          await userRef.update({
            walletAddress: address,
            updatedAt: FieldValue.serverTimestamp(),
          });
          ready = true;
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      if (!ready) {
        const referralCode = generateReferralCode(uid);
        const profile: UserProfile = {
          uid,
          email: null,
          displayName: created.displayName ?? null,
          photoURL: null,
          mobile: null,
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
      }
      needsProfile = true;
    } else {
      const profile = (await db.collection(Collections.users).doc(uid).get()).data() as
        | UserProfile
        | undefined;
      needsProfile = !profile?.mobile || !profile?.referredBy;
      // Ensure walletAddress set
      if (profile && !profile.walletAddress) {
        await db.collection(Collections.users).doc(uid).update({
          walletAddress: address,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    }

    const customToken = await auth.createCustomToken(uid, {
      walletAddress: address,
      loginMethod: 'wallet',
    });

    log.info('wallet_login', { uid, address, isNewUser, needsProfile });
    return {
      customToken,
      uid,
      address,
      isNewUser,
      needsProfile,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
