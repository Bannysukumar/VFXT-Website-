/**
 * One-shot: convert USD-cent ledger balances / open stakes / binary volume to VFXT tokens.
 *
 * tokens = floor(cents * tokensPerUsd / 100)
 *
 * Idempotent via config/platform.tokensOnlyMigratedAt — re-run is a no-op unless FORCE=1.
 *
 * Usage (from functions/):
 *   node scripts/migrate-usd-wallets-to-tokens.mjs
 *   FORCE=1 node scripts/migrate-usd-wallets-to-tokens.mjs
 */
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  resolve(root, '..', 'vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json'),
].filter(Boolean)
const keyPath = candidates.find((p) => existsSync(p))
if (!keyPath) {
  console.error('Missing Firebase admin credentials JSON')
  process.exit(1)
}
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath
JSON.parse(readFileSync(keyPath, 'utf8'))

const admin = require('firebase-admin')
const { FieldValue } = require('firebase-admin/firestore')
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() })
}
const db = admin.firestore()

const MIGRATE_KINDS = new Set([
  'fund',
  'staking',
  'daily_roi',
  'level_income',
  'withdrawal',
])

function centsToTokens(cents, tokensPerUsd) {
  const n = Number(cents) || 0
  if (n <= 0) return 0
  return Math.floor((n * tokensPerUsd) / 100)
}

const platformRef = db.collection('config').doc('platform')
const platformSnap = await platformRef.get()
const platform = platformSnap.exists ? platformSnap.data() : {}
const tokensPerUsd = Number(platform?.token?.tokensPerUsd) || 10_000
const force = process.env.FORCE === '1'

if (platform?.tokensOnlyMigratedAt && !force) {
  console.log('Already migrated at', platform.tokensOnlyMigratedAt.toDate?.() ?? platform.tokensOnlyMigratedAt)
  console.log('Set FORCE=1 to re-run (dangerous if balances already tokens).')
  process.exit(0)
}

console.log('Migrating USD cents → VFXT tokens at', tokensPerUsd, 'VFXT/$')

let walletsUpdated = 0
let stakesUpdated = 0
let usersUpdated = 0

// --- wallets ---
{
  let last = null
  for (;;) {
    let q = db.collection('wallets').orderBy('__name__').limit(200)
    if (last) q = q.startAfter(last)
    const snap = await q.get()
    if (snap.empty) break
    last = snap.docs[snap.docs.length - 1]

    const batch = db.batch()
    let writes = 0
    for (const doc of snap.docs) {
      const w = doc.data()
      const kind = w.kind || String(doc.id).split('_').pop()
      if (!MIGRATE_KINDS.has(kind)) continue
      if (w.currency === 'VFXT' && w.tokensOnlyMigrated === true && !force) continue

      const available = centsToTokens(w.availableMinor, tokensPerUsd)
      const reserved = centsToTokens(w.reservedMinor, tokensPerUsd)
      batch.update(doc.ref, {
        currency: 'VFXT',
        decimals: 0,
        availableMinor: available,
        reservedMinor: reserved,
        tokensOnlyMigrated: true,
        tokensOnlyMigratedFrom: {
          availableMinor: Number(w.availableMinor) || 0,
          reservedMinor: Number(w.reservedMinor) || 0,
          currency: w.currency || 'USD',
        },
        updatedAt: FieldValue.serverTimestamp(),
      })
      writes += 1
      walletsUpdated += 1
    }
    if (writes > 0) await batch.commit()
    if (snap.size < 200) break
  }
}

// --- open staking positions ---
{
  let last = null
  for (;;) {
    let q = db.collection('stakingPositions').orderBy('__name__').limit(200)
    if (last) q = q.startAfter(last)
    const snap = await q.get()
    if (snap.empty) break
    last = snap.docs[snap.docs.length - 1]

    const batch = db.batch()
    let writes = 0
    for (const doc of snap.docs) {
      const p = doc.data()
      if (p.tokensOnlyMigrated === true && !force) continue
      const principal = centsToTokens(p.principalMinor, tokensPerUsd)
      const totalPaid = centsToTokens(p.totalPaidMinor, tokensPerUsd)
      const cap = centsToTokens(p.capMinor, tokensPerUsd)
      batch.update(doc.ref, {
        principalMinor: principal,
        totalPaidMinor: totalPaid,
        capMinor: cap,
        tokensOnlyMigrated: true,
        tokensOnlyMigratedFrom: {
          principalMinor: Number(p.principalMinor) || 0,
          totalPaidMinor: Number(p.totalPaidMinor) || 0,
          capMinor: Number(p.capMinor) || 0,
        },
        updatedAt: FieldValue.serverTimestamp(),
      })
      writes += 1
      stakesUpdated += 1
    }
    if (writes > 0) await batch.commit()
    if (snap.size < 200) break
  }
}

// --- binary volume on users ---
{
  let last = null
  for (;;) {
    let q = db.collection('users').orderBy('__name__').limit(200)
    if (last) q = q.startAfter(last)
    const snap = await q.get()
    if (snap.empty) break
    last = snap.docs[snap.docs.length - 1]

    const batch = db.batch()
    let writes = 0
    for (const doc of snap.docs) {
      const u = doc.data()
      if (u.tokensOnlyMigrated === true && !force) continue
      const left = Number(u.leftVolumeMinor) || 0
      const right = Number(u.rightVolumeMinor) || 0
      if (left === 0 && right === 0) {
        batch.set(
          doc.ref,
          { tokensOnlyMigrated: true, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
        writes += 1
        usersUpdated += 1
        continue
      }
      batch.update(doc.ref, {
        leftVolumeMinor: centsToTokens(left, tokensPerUsd),
        rightVolumeMinor: centsToTokens(right, tokensPerUsd),
        tokensOnlyMigrated: true,
        tokensOnlyMigratedFrom: {
          leftVolumeMinor: left,
          rightVolumeMinor: right,
        },
        updatedAt: FieldValue.serverTimestamp(),
      })
      writes += 1
      usersUpdated += 1
    }
    if (writes > 0) await batch.commit()
    if (snap.size < 200) break
  }
}

await platformRef.set(
  {
    tokensOnlyMigratedAt: FieldValue.serverTimestamp(),
    tokensOnlyMigratedTokensPerUsd: tokensPerUsd,
    updatedAt: FieldValue.serverTimestamp(),
  },
  { merge: true },
)

console.log('Done.', { walletsUpdated, stakesUpdated, usersUpdated, tokensPerUsd })
