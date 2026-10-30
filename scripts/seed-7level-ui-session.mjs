/**
 * Build a full 7-level referral tree (with unlock pads), fund+stake the leaf,
 * qualify root for rank-1 salary, write session JSON for browser UI testing.
 *
 * node scripts/seed-7level-ui-session.mjs
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(__dirname, '../functions/package.json'))
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
process.env.GCLOUD_PROJECT = 'vfxt-a60d6'

const PROJECT = 'vfxt-a60d6'
const API_KEY = 'fake-api-key'
const REGION = 'us-central1'
const CALLABLE = (name) => `http://127.0.0.1:5001/${PROJECT}/${REGION}/${name}`
const AUTH_SIGNUP = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`
const AUTH_SIGNIN = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`
const ROOT_CODE = 'ROOTV7LWQO'
const PASSWORD = 'TestPass1'
const stamp = Date.now().toString(36)

initializeApp({ projectId: PROJECT })
const auth = getAuth()
const db = getFirestore()

async function callCallable(name, idToken, data = {}) {
  const res = await fetch(CALLABLE(name), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ data }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || JSON.stringify(json.error))
  return json.result ?? json
}

async function signUp(email, password, displayName) {
  const res = await fetch(AUTH_SIGNUP, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, returnSecureToken: true }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || 'signup failed')
  return json
}

async function signIn(email, password) {
  const res = await fetch(AUTH_SIGNIN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  })
  const json = await res.json()
  if (json.error) throw new Error(json.error.message || 'signin failed')
  return json
}

async function waitProfile(uid, tries = 40) {
  for (let i = 0; i < tries; i += 1) {
    const snap = await db.collection('users').doc(uid).get()
    if (snap.exists) return snap.data()
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`no profile ${uid}`)
}

async function walletBal(uid, kind) {
  const snap = await db.collection('wallets').doc(`${uid}_${kind}`).get()
  return snap.exists ? Number(snap.data().availableMinor || 0) : 0
}

async function ensureRoot() {
  const email = 'root.sponsor@test.local'
  // Prefer the existing owner of ROOT_CODE so lookup/finalize stay consistent.
  const byCode = await db
    .collection('users')
    .where('referralCode', '==', ROOT_CODE)
    .limit(5)
    .get()
  let user
  if (!byCode.empty) {
    // Keep one owner; re-key any duplicates.
    const primary = byCode.docs[0]
    user = { uid: primary.id }
    for (let i = 1; i < byCode.docs.length; i += 1) {
      const dup = byCode.docs[i]
      await dup.ref.set(
        { referralCode: `OLD${ROOT_CODE.slice(0, 8)}${i}`, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      )
    }
    try {
      await auth.getUser(user.uid)
    } catch {
      /* profile-only */
    }
  } else {
    try {
      user = await auth.getUserByEmail(email)
    } catch {
      const created = await signUp(email, PASSWORD, 'Root Sponsor')
      user = { uid: created.localId }
      await waitProfile(user.uid)
    }
  }

  const snap = await db.collection('users').doc(user.uid).get()
  const existingEmail = snap.exists ? snap.data()?.email : email
  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      email: existingEmail || email,
      displayName: 'Root Sponsor',
      mobile: '+910000000001',
      referralCode: ROOT_CODE,
      referredBy: null,
      status: 'active',
      role: 'admin',
      adminRole: 'super_admin',
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  try {
    await auth.setCustomUserClaims(user.uid, { adminRole: 'super_admin' })
    await auth.updateUser(user.uid, { emailVerified: true, password: PASSWORD })
  } catch {
    /* may be email-less wallet user */
  }
  await db.collection('admins').doc(user.uid).set(
    { uid: user.uid, adminRole: 'super_admin', updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )

  // Ensure we can sign in with a known password for UI tests.
  let loginEmail = existingEmail || email
  if (!loginEmail || typeof loginEmail !== 'string') loginEmail = email
  try {
    await auth.updateUser(user.uid, { email: loginEmail, password: PASSWORD, emailVerified: true })
  } catch {
    /* ignore */
  }
  const token = (await signIn(loginEmail, PASSWORD)).idToken
  return {
    uid: user.uid,
    email: loginEmail,
    password: PASSWORD,
    code: ROOT_CODE,
    token,
    level: 0,
    name: 'Root Sponsor',
  }
}

async function main() {
  console.log('Seeding 7-level UI session…')
  const root = await ensureRoot()
  const chain = [root]

  for (let i = 1; i <= 7; i += 1) {
    const email = `l${i}.${stamp}@test.local`
    const name = `Level ${i} Member`
    const signed = await signUp(email, PASSWORD, name)
    await waitProfile(signed.localId)
    await callCallable('finalizeRegistration', signed.idToken, {
      referralCode: chain[i - 1].code,
      mobile: `+91000001${100 + i}`,
      displayName: name,
    })
    await auth.updateUser(signed.localId, { emailVerified: true })
    const profile = await waitProfile(signed.localId)
    const token = (await signIn(email, PASSWORD)).idToken
    chain.push({
      uid: signed.localId,
      email,
      password: PASSWORD,
      code: profile.referralCode,
      token,
      level: i,
      name,
    })
    console.log(`  L${i} ${email} under ${chain[i - 1].code} → ${profile.referralCode}`)
  }

  // Pad directs so L1..L7 commissions unlock when leaf stakes
  const padTargets = [
    { user: chain[0], need: 7 },
    { user: chain[1], need: 6 },
    { user: chain[2], need: 5 },
    { user: chain[3], need: 4 },
    { user: chain[4], need: 3 },
    { user: chain[5], need: 2 },
    { user: chain[6], need: 1 },
  ]
  for (const { user, need } of padTargets) {
    const existing = await db
      .collection('referrals')
      .where('referrerId', '==', user.uid)
      .where('status', '==', 'active')
      .get()
    for (let n = existing.size; n < need; n += 1) {
      const email = `pad.l${user.level}.${n}.${stamp}@test.local`
      const s = await signUp(email, PASSWORD, `Pad ${user.level}-${n}`)
      await waitProfile(s.localId)
      await callCallable('finalizeRegistration', s.idToken, {
        referralCode: user.code,
        mobile: `+9188${String(user.level).padStart(2, '0')}${String(n).padStart(6, '0')}`,
      })
    }
  }
  console.log('  Pads complete')

  const leaf = chain[7]
  let rootToken = (await signIn(root.email, PASSWORD)).idToken
  await callCallable('adminAdjustWallet', rootToken, {
    uid: leaf.uid,
    walletKind: 'fund',
    amountMinor: 1000_00,
    reason: 'UI session fund for stake+deposit tests',
  })
  await callCallable('adminAdjustWallet', rootToken, {
    uid: leaf.uid,
    walletKind: 'withdrawal',
    amountMinor: 200_00,
    reason: 'UI session withdrawal balance',
  })

  leaf.token = (await signIn(leaf.email, PASSWORD)).idToken
  const stake = await callCallable('createStakingPosition', leaf.token, {
    planId: 'daily_yield',
    amountMinor: 100_00,
    idempotencyKey: `ui-session-stake-${stamp}`,
  })
  console.log('  Stake', stake.positionId)
  await new Promise((r) => setTimeout(r, 2000))

  const incomes = []
  const expected = [50, 50, 25, 25, 20, 20, 10]
  for (let level = 1; level <= 7; level += 1) {
    const payee = chain[7 - level]
    const bal = await walletBal(payee.uid, 'level_income')
    incomes.push({
      level,
      email: payee.email,
      code: payee.code,
      levelIncomeCents: bal,
      ok: bal >= expected[level - 1],
    })
  }
  const directBonus = await walletBal(chain[6].uid, 'direct_referral')

  // Rank/salary qualification on root (rank 1 = $1000/$1000)
  await db.collection('users').doc(root.uid).set(
    {
      leftVolumeMinor: 150_000,
      rightVolumeMinor: 150_000,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
  rootToken = (await signIn(root.email, PASSWORD)).idToken
  const rank = await callCallable('getRankStatus', rootToken, {})

  // Apply rank-1 salary credit once (scheduled job equivalent for emulator UI)
  const rewardMinor = 10_00
  const beforeSalary = await walletBal(root.uid, 'level_income')
  if ((rank.qualifiedRank ?? 0) >= 1) {
    await callCallable('adminAdjustWallet', rootToken, {
      uid: root.uid,
      walletKind: 'level_income',
      amountMinor: rewardMinor,
      reason: 'Emulator rank-1 salary payout (schedule substitute)',
    })
  }
  const afterSalary = await walletBal(root.uid, 'level_income')

  const session = {
    stamp,
    password: PASSWORD,
    appUrl: 'http://127.0.0.1:5173',
    registerRootUrl: `http://127.0.0.1:5173/auth/register?ref=${ROOT_CODE}`,
    root,
    chain: chain.map(({ uid, email, password, code, level, name }) => ({
      uid,
      email,
      password,
      code,
      level,
      name,
      loginUrl: 'http://127.0.0.1:5173/auth/login',
    })),
    leaf: {
      ...leaf,
      fundAfterStakeCents: await walletBal(leaf.uid, 'fund'),
      stakingCents: await walletBal(leaf.uid, 'staking'),
      withdrawalCents: await walletBal(leaf.uid, 'withdrawal'),
    },
    verification: {
      incomes,
      directBonusVfxt: directBonus,
      rank,
      salaryBeforeCents: beforeSalary,
      salaryAfterCents: afterSalary,
      stakePositionId: stake.positionId,
    },
  }

  const out = path.join(__dirname, 'ui-session-7level.json')
  fs.writeFileSync(out, JSON.stringify(session, null, 2))
  console.log('\nWrote', out)
  console.log(
    JSON.stringify(
      {
        ok: true,
        leaf: leaf.email,
        incomesOk: incomes.every((i) => i.ok),
        directBonus,
        qualifiedRank: rank.qualifiedRank,
        salaryAfterCents: afterSalary,
      },
      null,
      2,
    ),
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
