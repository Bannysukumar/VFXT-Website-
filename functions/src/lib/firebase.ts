import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let app: App;
let db: Firestore;
let auth: Auth;

/**
 * Lazily initialize the Admin SDK once per cold start.
 * Safe to call from any module; subsequent calls are no-ops.
 */
export function initAdmin(): App {
  if (getApps().length === 0) {
    app = initializeApp();
  } else {
    app = getApps()[0]!;
  }
  return app;
}

export function getDb(): Firestore {
  if (!db) {
    initAdmin();
    db = getFirestore();
    // Prefer integer-safe money handling; never store floats for balances.
    db.settings({ ignoreUndefinedProperties: true });
  }
  return db;
}

export function getAdminAuth(): Auth {
  if (!auth) {
    initAdmin();
    auth = getAuth();
  }
  return auth;
}

/** Common Firestore collection names. */
export const Collections = {
  users: 'users',
  wallets: 'wallets',
  ledger: 'ledger',
  deposits: 'deposits',
  withdrawals: 'withdrawals',
  referrals: 'referrals',
  stakingConfigs: 'stakingConfigs',
  stakingPositions: 'stakingPositions',
  supportTickets: 'supportTickets',
  auditLogs: 'auditLogs',
  idempotencyKeys: 'idempotencyKeys',
  token: 'token',
  config: 'config',
  featureFlags: 'featureFlags',
  admins: 'admins',
  rankPayouts: 'rankPayouts',
  planConfig: 'planConfig',
  /** Server-only secrets (private keys). Rules must deny all client access. */
  secrets: 'secrets',
  usedCryptoTx: 'usedCryptoTx',
} as const;
