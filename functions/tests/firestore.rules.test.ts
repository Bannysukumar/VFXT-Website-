import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const PROJECT_ID = 'vfxt-rules-test';
const RULES_PATH = resolve(__dirname, '../../firestore.rules');

let testEnv: RulesTestEnvironment | undefined;
let rulesAvailable = true;

describe('firestore.rules', () => {
  beforeAll(async () => {
    try {
      testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {
          rules: readFileSync(RULES_PATH, 'utf8'),
          host: '127.0.0.1',
          port: 8080,
        },
      });
    } catch (err) {
      rulesAvailable = false;
      console.warn(
        'Skipping firestore rules tests — start the Firestore emulator on :8080.',
        err instanceof Error ? err.message : err,
      );
    }
  }, 60_000);

  afterAll(async () => {
    await testEnv?.cleanup();
  });

  beforeEach(async () => {
    if (!rulesAvailable || !testEnv) return;
    await testEnv.clearFirestore();
  });

  it('allows user to read own profile', async ({ skip }) => {
    if (!rulesAvailable || !testEnv) {
      skip();
      return;
    }
    const env = testEnv;
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/alice'), {
        uid: 'alice',
        displayName: 'Alice',
        status: 'active',
      });
    });

    const alice = env.authenticatedContext('alice');
    await assertSucceeds(getDoc(doc(alice.firestore(), 'users/alice')));
  });

  it('denies user writing wallet balances', async ({ skip }) => {
    if (!rulesAvailable || !testEnv) {
      skip();
      return;
    }
    const env = testEnv;
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'wallets/alice_USD'), {
        walletId: 'alice_USD',
        userId: 'alice',
        currency: 'USD',
        availableMinor: 0,
        reservedMinor: 0,
      });
    });

    const alice = env.authenticatedContext('alice');
    await assertFails(
      updateDoc(doc(alice.firestore(), 'wallets/alice_USD'), {
        availableMinor: 1_000_000,
      }),
    );
    await assertFails(
      setDoc(doc(alice.firestore(), 'wallets/alice_USD'), {
        walletId: 'alice_USD',
        userId: 'alice',
        availableMinor: 999,
      }),
    );
  });

  it('denies user writing ledger', async ({ skip }) => {
    if (!rulesAvailable || !testEnv) {
      skip();
      return;
    }
    const alice = testEnv.authenticatedContext('alice');
    await assertFails(
      setDoc(doc(alice.firestore(), 'ledger/entry1'), {
        entryId: 'entry1',
        userId: 'alice',
        amountMinor: 100,
        type: 'deposit_credit',
      }),
    );
  });

  it('allows privileged admin to read audit logs (custom claims)', async ({
    skip,
  }) => {
    if (!rulesAvailable || !testEnv) {
      skip();
      return;
    }
    const env = testEnv;
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'auditLogs/log1'), {
        logId: 'log1',
        actorId: 'admin1',
        action: 'deposit.approve',
        resourceType: 'deposit',
        resourceId: 'd1',
      });
    });

    const admin = env.authenticatedContext('admin1', {
      adminRole: 'finance_admin',
    });
    await assertSucceeds(getDoc(doc(admin.firestore(), 'auditLogs/log1')));

    const user = env.authenticatedContext('alice');
    await assertFails(getDoc(doc(user.firestore(), 'auditLogs/log1')));
  });
});
