/**
 * Cancel pending audit/test deposits and delete auth-only QA accounts.
 * Usage: node scripts/cleanup-audit-artifacts.mjs
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'functions/package.json'))
const admin = require('firebase-admin')

const sa = JSON.parse(
  readFileSync(path.join(root, 'vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json'), 'utf8'),
)
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(sa) })
}
const db = admin.firestore()
const auth = admin.auth()

const DEPOSIT_IDS = [
  'bcd89baa-8679-477c-8647-9b7d0e06726c',
  'e60edc23-94d2-4aa5-af33-fb99f2d45d9c',
  'a89fd1d1-e3c9-4cdd-8476-1b359446d1f9',
  '9719b45f-7426-40af-a85f-dd7fcb2ef46a',
]

const AUTH_UIDS = ['rHYGzrclUrhgwWUuQBUXIO9ld5s1', 'VmTFEVz8XgPmR3e96YUqDxCIVv52']

for (const id of DEPOSIT_IDS) {
  const ref = db.collection('deposits').doc(id)
  const snap = await ref.get()
  if (!snap.exists) {
    console.log(`deposit ${id}: missing`)
    continue
  }
  const status = String(snap.data()?.status ?? '')
  if (status === 'awaiting_payment' || status === 'pending') {
    await ref.set(
      {
        status: 'cancelled',
        cancellationReason: 'audit cleanup',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    console.log(`deposit ${id}: cancelled (was ${status})`)
  } else {
    console.log(`deposit ${id}: left as ${status}`)
  }
}

for (const uid of AUTH_UIDS) {
  const profile = await db.collection('users').doc(uid).get()
  if (profile.exists) {
    console.log(`auth ${uid}: has Firestore profile — not deleted`)
    continue
  }
  try {
    const user = await auth.getUser(uid)
    if (user.email && !/@mailinator\.com$/i.test(user.email)) {
      console.log(`auth ${uid}: email ${user.email} — skip (not mailinator)`)
      continue
    }
    await auth.deleteUser(uid)
    console.log(`auth ${uid}: deleted (${user.email ?? 'no-email'})`)
  } catch (err) {
    console.log(`auth ${uid}: ${err instanceof Error ? err.message : String(err)}`)
  }
}

console.log('Done.')
