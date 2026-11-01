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
import { isWalletDeviceRevoked } from './wallet-app-devices';

const NONCE_TTL_MS = 10 * 60 * 1000;

function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

function walletUid(address: string): string {
  return `w_${normalizeAddress(address).slice(2)}`;
}

function buildMessage(address: string, nonce: string): string {
  return [
    'VFXT Wallet — Sign in',
    '',
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    '',
    'This signature proves you own this wallet. It does not cost gas.',
  ].join('\n');
}

/** Public nonce for Android wallet mining auth (no referral required). */
export const getWalletAppNonce = onCall(CALLABLE_OPTS, async (request) => {
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
    await db.collection(Collections.config).doc(`walletAppNonce_${address}`).set({
      address,
      nonce,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + NONCE_TTL_MS),
    });
    return { nonce, message: buildMessage(address, nonce), address };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/**
 * Verifies EIP-191 personal_sign, creates/updates the wallet-app user, returns a Firebase custom token.
 * Never accepts or stores private keys / seed phrases.
 */
export const verifyWalletAppLogin = onCall(CALLABLE_OPTS, async (request) => {
  try {
    initAdmin();
    const parsed = z
      .object({
        address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
        signature: z.string().min(80).max(200),
        installId: z.string().max(64).optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', 'Address and signature required');
    }

    const address = normalizeAddress(parsed.data.address);
    const db = getDb();
    const nonceRef = db.collection(Collections.config).doc(`walletAppNonce_${address}`);
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
    const message = buildMessage(address, nonce);

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

    const auth = getAuth();
    const uid = walletUid(address);

    if (await isWalletDeviceRevoked(uid, parsed.data.installId)) {
      throw new AppError(
        'permission-denied',
        'This device was signed out of your VFXT account from another device. Reinstall the app and import your wallet to sign in again.',
      );
    }

    try {
      await auth.getUser(uid);
    } catch {
      await auth.createUser({
        uid,
        displayName: `Wallet ${address.slice(0, 6)}…${address.slice(-4)}`,
      });
    }

    const userRef = db.collection(Collections.users).doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      await userRef.set({
        uid,
        username: `${address.slice(0, 6)}…${address.slice(-4)}`,
        email: null,
        walletAddress: address,
        accountStatus: 'active',
        source: 'android_wallet',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await userRef.set(
        {
          walletAddress: address,
          accountStatus: userSnap.data()?.accountStatus ?? 'active',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const customToken = await auth.createCustomToken(uid, {
      walletAddress: address,
      loginMethod: 'wallet_app',
    });

    log.info('wallet_app_login', { uid, address });
    return { customToken, uid, address };
  } catch (err) {
    throw toHttpsError(err);
  }
});
