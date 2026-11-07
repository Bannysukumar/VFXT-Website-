/**
 * Emulator smoke: transferToUserSchema must accept note:null (Firebase wire encoding).
 *
 * Run:
 *   firebase emulators:exec --only auth,firestore,functions \
 *     "node functions/scripts/emulator-peer-transfer-note.mjs"
 */
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.GCLOUD_PROJECT ??= 'vfxt-a60d6';
process.env.GOOGLE_CLOUD_PROJECT ??= 'vfxt-a60d6';

const { transferToUserSchema } = require(
  resolve(root, 'lib/modules/wallets/peer-transfer.schemas.js'),
);

const base = {
  toUserId: 'VFXT2533',
  walletKind: 'daily_roi',
  amountMinor: 1000,
  idempotencyKey: 'emulator-note-null-key',
};

const withNull = transferToUserSchema.safeParse({ ...base, note: null });
if (!withNull.success) {
  console.error('FAIL: note:null rejected', withNull.error.issues);
  process.exit(1);
}

const withoutNote = transferToUserSchema.safeParse(base);
if (!withoutNote.success) {
  console.error('FAIL: missing note rejected', withoutNote.error.issues);
  process.exit(1);
}

console.log('OK: peer transfer accepts empty/null note (no Expected string, received null)');
