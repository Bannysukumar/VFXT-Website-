/**
 * Emulator smoke: unverified Auth user must pass gateEmailVerifiedForFinance
 * while FeatureFlags.requireEmailVerifiedForFinance === false.
 *
 * Run:
 *   firebase emulators:exec --only auth,firestore,functions \
 *     "node functions/scripts/emulator-deposit-email-gate.mjs"
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

const { FeatureFlags } = require(resolve(root, 'lib/config/features.js'));
const { gateEmailVerifiedForFinance } = require(
  resolve(root, 'lib/modules/auth/helpers.js'),
);

if (FeatureFlags.requireEmailVerifiedForFinance !== false) {
  console.error(
    'FAIL: requireEmailVerifiedForFinance must be false, got',
    FeatureFlags.requireEmailVerifiedForFinance,
  );
  process.exit(1);
}

await gateEmailVerifiedForFinance({
  uid: 'emulator-unverified',
  email: 'unverified@example.com',
  emailVerified: false,
  adminRole: null,
  token: {},
});

console.log(
  'OK: unverified email passes finance gate (deposits not blocked by email verify)',
);
