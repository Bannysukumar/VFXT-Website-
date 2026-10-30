/**
 * Seed a stable sponsor for UI tests: referral code ROOTV7LWQO
 * Usage (emulators running): node scripts/seed-emulator-root.mjs
 */
import { createRequire } from 'module'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(path.join(__dirname, '../functions/package.json'))
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080'
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'
process.env.GCLOUD_PROJECT = 'vfxt-a60d6'

const PROJECT = 'vfxt-a60d6'
const CODE = 'ROOTV7LWQO'
const EMAIL = 'root.sponsor@test.local'
const PASSWORD = 'TestPass1'

initializeApp({ projectId: PROJECT })
const auth = getAuth()
const db = getFirestore()

async function main() {
  let user
  try {
    user = await auth.getUserByEmail(EMAIL)
  } catch {
    user = await auth.createUser({
      email: EMAIL,
      password: PASSWORD,
      displayName: 'Root Sponsor',
      emailVerified: true,
    })
  }

  // Wait for onUserCreated if it fires
  for (let i = 0; i < 20; i += 1) {
    const snap = await db.collection('users').doc(user.uid).get()
    if (snap.exists) break
    await new Promise((r) => setTimeout(r, 200))
  }

  await db.collection('users').doc(user.uid).set(
    {
      uid: user.uid,
      email: EMAIL,
      displayName: 'Root Sponsor',
      mobile: '+910000000001',
      referralCode: CODE,
      referredBy: null,
      status: 'active',
      role: 'admin',
      adminRole: 'super_admin',
      leftVolumeMinor: 0,
      rightVolumeMinor: 0,
      currentRank: 0,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  await auth.setCustomUserClaims(user.uid, { adminRole: 'super_admin' })
  await db.collection('admins').doc(user.uid).set(
    {
      uid: user.uid,
      adminRole: 'super_admin',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )

  console.log(
    JSON.stringify(
      {
        ok: true,
        uid: user.uid,
        email: EMAIL,
        password: PASSWORD,
        referralCode: CODE,
        registerUrl: `http://127.0.0.1:5173/auth/register?ref=${CODE}`,
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
