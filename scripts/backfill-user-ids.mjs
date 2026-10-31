/**
 * Backfill short public User IDs (VFXT2500+) for all Firestore users.
 *
 * Usage:
 *   node scripts/backfill-user-ids.mjs
 *   node scripts/backfill-user-ids.mjs --dry-run
 *
 * Uses: vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json in project root
 */
import { createRequire } from 'module'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const require = createRequire(path.join(root, 'functions/package.json'))
const { initializeApp, cert } = require('firebase-admin/app')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')

const DRY_RUN = process.argv.includes('--dry-run')
const START_AT = 2500
const SHORT_ID_RE = /^VFXT\d{4,}$/
const COUNTER_DOC = 'userIdCounter'
const SA_PATH = path.join(root, 'vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json')

if (!fs.existsSync(SA_PATH)) {
  console.error(`Missing service account: ${SA_PATH}`)
  process.exit(1)
}

const sa = JSON.parse(fs.readFileSync(SA_PATH, 'utf8'))
initializeApp({
  credential: cert(sa),
  projectId: sa.project_id || 'vfxt-a60d6',
})
const db = getFirestore()

function isShortUserId(code) {
  return typeof code === 'string' && SHORT_ID_RE.test(code.trim().toUpperCase())
}

async function main() {
  console.log(DRY_RUN ? 'DRY RUN — no writes' : 'LIVE — writing User IDs')
  console.log(`Project: ${sa.project_id}`)

  const snap = await db.collection('users').get()
  console.log(`Users found: ${snap.size}`)

  const already = []
  const need = []
  let maxNum = START_AT - 1

  for (const doc of snap.docs) {
    const data = doc.data() || {}
    const code = typeof data.referralCode === 'string' ? data.referralCode.trim().toUpperCase() : ''
    if (isShortUserId(code)) {
      already.push({ uid: doc.id, code })
      const n = Number(code.replace(/^VFXT/, ''))
      if (Number.isFinite(n) && n > maxNum) maxNum = n
    } else {
      need.push({
        uid: doc.id,
        email: data.email ?? null,
        oldCode: code || null,
        displayName: data.displayName ?? null,
      })
    }
  }

  console.log(`Already have short User ID: ${already.length}`)
  console.log(`Need new User ID: ${need.length}`)
  console.log(`Highest existing VFXT number: ${maxNum}`)

  // Sort for stable assignment (by createdAt if present, else uid)
  need.sort((a, b) => a.uid.localeCompare(b.uid))

  let next = maxNum + 1
  if (next < START_AT) next = START_AT

  const assigned = []
  const used = new Set(already.map((a) => a.code))

  for (const user of need) {
    let code = `VFXT${next}`
    while (used.has(code)) {
      next += 1
      code = `VFXT${next}`
    }
    used.add(code)
    assigned.push({ ...user, newCode: code })
    next += 1
  }

  if (DRY_RUN) {
    console.log('\nSample assignments (up to 20):')
    for (const row of assigned.slice(0, 20)) {
      console.log(`  ${row.uid}  ${row.oldCode ?? '(none)'}  →  ${row.newCode}  ${row.email ?? ''}`)
    }
    if (assigned.length > 20) console.log(`  … +${assigned.length - 20} more`)
    console.log(`\nCounter would be set to next=${next}`)
    return
  }

  // Batch writes (500 limit)
  let batch = db.batch()
  let ops = 0
  let written = 0

  async function flush() {
    if (ops === 0) return
    await batch.commit()
    written += ops
    console.log(`  committed ${written}/${assigned.length}`)
    batch = db.batch()
    ops = 0
  }

  for (const row of assigned) {
    const ref = db.collection('users').doc(row.uid)
    batch.update(ref, {
      referralCode: row.newCode,
      previousReferralCode: row.oldCode,
      updatedAt: FieldValue.serverTimestamp(),
    })
    ops += 1
    if (ops >= 400) await flush()
  }
  await flush()

  // Advance counter past all allocated ids
  await db
    .collection('config')
    .doc(COUNTER_DOC)
    .set({ next, updatedAt: new Date().toISOString(), backfilledAt: new Date().toISOString() }, { merge: true })

  console.log(`\nDone. Updated ${assigned.length} users. Counter next=${next}`)
  console.log('Sample:')
  for (const row of assigned.slice(0, 10)) {
    console.log(`  ${row.newCode}  ←  ${row.oldCode ?? '(none)'}  (${row.email ?? row.uid})`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
