/**
 * PRODUCTION RESET — keep super_admin Auth users only, wipe member data,
 * reset platform mins, and issue clean referral codes.
 *
 * Usage:
 *   node scripts/production-reset-keep-superadmin.mjs
 *
 * Requires: vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json in repo root.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const require = createRequire(path.join(root, 'functions/package.json'))
const admin = require('firebase-admin')

const sa = JSON.parse(
  readFileSync(path.join(root, 'vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json'), 'utf8'),
)
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}

const auth = admin.auth()
const db = admin.firestore()
const { FieldValue } = admin.firestore

const SITE_ORIGIN = 'https://virtualfxtrades.com'
const WALLET_KINDS = [
  'fund',
  'staking',
  'daily_roi',
  'level_income',
  'direct_referral',
  'withdrawal',
  'vfxt',
]

/** Collections fully wiped (member / transactional data). */
const WIPE_COLLECTIONS = [
  'auditLogs',
  'deposits',
  'idempotencyKeys',
  'ledger',
  'mining_balances',
  'mining_sessions',
  'mining_booster_purchases',
  'mining_user_boosters',
  'claim_requests',
  'reward_ledger',
  'referrals',
  'stakingPositions',
  'rankPayouts',
  'supportTickets',
  'usedCryptoTx',
  'wallets',
  'withdrawals',
  'users',
]

/** Keep: admins, secrets, mining_configs, mining_boosters, config/platform, config/walletApk */

async function deleteQueryBatch(colRef, batchSize = 400) {
  let total = 0
  for (;;) {
    const snap = await colRef.limit(batchSize).get()
    if (snap.empty) break
    const batch = db.batch()
    for (const doc of snap.docs) batch.delete(doc.ref)
    await batch.commit()
    total += snap.size
    if (snap.size < batchSize) break
  }
  return total
}

async function listAllAuthUsers() {
  const users = []
  let page = await auth.listUsers(1000)
  users.push(...page.users)
  while (page.pageToken) {
    page = await auth.listUsers(1000, page.pageToken)
    users.push(...page.users)
  }
  return users
}

async function ensureWallets(uid) {
  const now = FieldValue.serverTimestamp()
  const batch = db.batch()
  for (const kind of WALLET_KINDS) {
    const walletId = `${uid}_${kind}`
    batch.set(
      db.collection('wallets').doc(walletId),
      {
        walletId,
        userId: uid,
        kind,
        currency: 'VFXT',
        availableMinor: 0,
        reservedMinor: 0,
        decimals: 0,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    )
  }
  await batch.commit()
}

async function main() {
  console.log('=== PRODUCTION RESET (keep super_admin only) ===\n')

  const authUsers = await listAllAuthUsers()
  const superAdmins = authUsers.filter((u) => u.customClaims?.adminRole === 'super_admin')
  if (superAdmins.length === 0) {
    throw new Error('No super_admin found — aborting to avoid lockout')
  }
  const keepUids = new Set(superAdmins.map((u) => u.uid))
  console.log(
    'Keeping super admins:',
    superAdmins.map((u) => `${u.email} (${u.uid})`).join(', '),
  )

  // 1) Delete non-admin Auth users
  const toDelete = authUsers.filter((u) => !keepUids.has(u.uid))
  console.log(`\nDeleting ${toDelete.length} Auth users…`)
  for (let i = 0; i < toDelete.length; i += 100) {
    const chunk = toDelete.slice(i, i + 100)
    await auth.deleteUsers(chunk.map((u) => u.uid))
    console.log(`  deleted Auth ${Math.min(i + chunk.length, toDelete.length)}/${toDelete.length}`)
  }

  // 2) Wipe transactional collections
  console.log('\nWiping Firestore collections…')
  for (const name of WIPE_COLLECTIONS) {
    const n = await deleteQueryBatch(db.collection(name))
    if (n > 0) console.log(`  ${name}: deleted ${n}`)
  }

  // Clear ephemeral config docs (keep platform + walletApk + reset counter)
  const configSnap = await db.collection('config').get()
  for (const doc of configSnap.docs) {
    if (doc.id === 'platform' || doc.id === 'walletApk') continue
    await doc.ref.delete()
    console.log(`  config/${doc.id}: deleted`)
  }

  // Keep only super_admin docs in admins/
  const adminSnap = await db.collection('admins').get()
  for (const doc of adminSnap.docs) {
    if (!keepUids.has(doc.id)) {
      await doc.ref.delete()
      console.log(`  admins/${doc.id}: deleted`)
    }
  }

  // 3) Production platform settings
  console.log('\nWriting production platform settings…')
  const nowIso = new Date().toISOString()
  await db
    .collection('config')
    .doc('platform')
    .set(
      {
        contact: {
          companyName: 'Virtual FX Trades',
          email: 'support@virtualfxtrades.com',
          phone: '',
          addressLine1: '',
          addressLine2: '',
          city: '',
          region: '',
          postalCode: '',
          country: 'United States',
          supportHours: 'Mon–Fri 9:00–18:00 (US Eastern)',
        },
        deposit: {
          minDepositUsdCents: 1_000, // $10 USDT
          minVfxtDepositTokens: 10,
        },
        token: {
          tokensPerUsd: 10_000, // $0.0001 / VFXT
        },
        withdraw: {
          minWithdrawUsdCents: 1_000, // $10 ≈ 100,000 VFXT
          commissionBps: 500, // 5%
          autoWithdrawEnabled: true,
          requireProfileAddress: true,
        },
        plan: {
          minStakeUsdCents: 10_000, // $100 ≈ 1,000,000 VFXT
          dailyRateBps: 100,
          maxDays: 200,
          nonWorkingCapX: 2,
          workingCapX: 3,
          levelCommissionBps: [50, 50, 25, 25, 20, 20, 10],
          directReferralBonusBps: 500,
          lockedPackages: [
            {
              id: 'locked_300',
              days: 300,
              multiplier: 3,
              bonusTokenPct: 50,
              label: '300-day · 3X',
              enabled: true,
            },
            {
              id: 'locked_500',
              days: 500,
              multiplier: 5,
              bonusTokenPct: 100,
              label: '500-day · 5X',
              enabled: true,
            },
            {
              id: 'locked_700',
              days: 700,
              multiplier: 7,
              bonusTokenPct: 150,
              label: '700-day · 7X',
              enabled: true,
            },
          ],
          rankRewards: [
            { rank: 1, leftUsd: 1_000, rightUsd: 1_000, rewardUsd: 10, cycleDays: 7, enabled: true },
            { rank: 2, leftUsd: 2_000, rightUsd: 2_000, rewardUsd: 20, cycleDays: 7, enabled: true },
            { rank: 3, leftUsd: 5_000, rightUsd: 5_000, rewardUsd: 50, cycleDays: 7, enabled: true },
            {
              rank: 4,
              leftUsd: 10_000,
              rightUsd: 10_000,
              rewardUsd: 100,
              cycleDays: 15,
              enabled: true,
            },
            {
              rank: 5,
              leftUsd: 15_000,
              rightUsd: 15_000,
              rewardUsd: 150,
              cycleDays: 15,
              enabled: true,
            },
            {
              rank: 6,
              leftUsd: 20_000,
              rightUsd: 20_000,
              rewardUsd: 200,
              cycleDays: 15,
              enabled: true,
            },
            {
              rank: 7,
              leftUsd: 30_000,
              rightUsd: 30_000,
              rewardUsd: 300,
              cycleDays: 30,
              enabled: true,
            },
            {
              rank: 8,
              leftUsd: 50_000,
              rightUsd: 50_000,
              rewardUsd: 500,
              cycleDays: 30,
              enabled: true,
            },
            {
              rank: 9,
              leftUsd: 100_000,
              rightUsd: 100_000,
              rewardUsd: 1_000,
              cycleDays: 30,
              enabled: true,
            },
          ],
        },
        hotWalletPool: {
          multiWalletEnabled: false,
        },
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'production-reset-script',
        productionReadyAt: nowIso,
      },
      { merge: true },
    )

  // Reset user id counter so next member is VFXT2502 after admins take 2500/2501
  await db.collection('config').doc('userIdCounter').set({
    next: 2500 + superAdmins.length,
    updatedAt: nowIso,
    resetAt: nowIso,
    resetBy: 'production-reset-script',
  })

  // 4) Recreate clean super-admin user profiles + wallets + referral codes
  console.log('\nProvisioning super admin profiles…')
  // Prefer stable codes: primary company admin gets VFXT2500
  const ordered = [...superAdmins].sort((a, b) => {
    const score = (u) =>
      String(u.email || '').toLowerCase() === 'admin@virtualfxtrades.com' ? 0 : 1
    return score(a) - score(b)
  })

  const links = []
  let codeNum = 2500
  for (const u of ordered) {
    const referralCode = `VFXT${codeNum}`
    codeNum += 1
    const email = u.email || null
    await db
      .collection('users')
      .doc(u.uid)
      .set(
        {
          uid: u.uid,
          email,
          displayName: u.displayName || email?.split('@')[0] || 'Super Admin',
          mobile: null,
          referralCode,
          referredBy: null,
          status: 'active',
          role: 'admin',
          adminRole: 'super_admin',
          leftVolumeMinor: 0,
          rightVolumeMinor: 0,
          currentRank: 0,
          walletAddress: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

    await db
      .collection('admins')
      .doc(u.uid)
      .set(
        {
          uid: u.uid,
          adminRole: 'super_admin',
          updatedAt: FieldValue.serverTimestamp(),
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      )

    await auth.setCustomUserClaims(u.uid, { adminRole: 'super_admin' })
    await ensureWallets(u.uid)

    const registerUrl = `${SITE_ORIGIN}/auth/register?ref=${referralCode}`
    links.push({
      email,
      uid: u.uid,
      referralCode,
      registerUrl,
    })
    console.log(`  ${email}: ${referralCode}`)
  }

  // Final counts
  const remainingAuth = await listAllAuthUsers()
  const userCount = (await db.collection('users').count().get()).data().count
  const walletCount = (await db.collection('wallets').count().get()).data().count
  const platform = (await db.collection('config').doc('platform').get()).data()

  console.log('\n=== DONE — production ready ===')
  console.log(
    JSON.stringify(
      {
        authUsersRemaining: remainingAuth.length,
        userDocs: userCount,
        wallets: walletCount,
        depositMinUsd: (platform.deposit.minDepositUsdCents / 100).toFixed(2),
        depositMinVfxt: platform.deposit.minVfxtDepositTokens,
        withdrawMinUsd: (platform.withdraw.minWithdrawUsdCents / 100).toFixed(2),
        withdrawMinVfxtApprox:
          (platform.withdraw.minWithdrawUsdCents * platform.token.tokensPerUsd) / 100,
        stakeMinUsd: (platform.plan.minStakeUsdCents / 100).toFixed(2),
        stakeMinVfxtApprox: (platform.plan.minStakeUsdCents * platform.token.tokensPerUsd) / 100,
        tokensPerUsd: platform.token.tokensPerUsd,
        withdrawCommissionPct: platform.withdraw.commissionBps / 100,
        autoWithdrawEnabled: platform.withdraw.autoWithdrawEnabled,
        superAdmins: links,
      },
      null,
      2,
    ),
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
