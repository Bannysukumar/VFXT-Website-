/**
 * Set dashboard campaign window via Admin SDK.
 * Starts: 08-11-2026 12:00 AM Asia/Kolkata (IST)
 * Ends:   30-11-2026 11:59:59 PM IST (month end)
 *
 * Usage: node scripts/set-campaign-schedule.mjs
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

// 08 Nov 2026 00:00:00 IST = 07 Nov 2026 18:30:00 UTC
const startsAt = admin.firestore.Timestamp.fromDate(new Date('2026-11-07T18:30:00.000Z'))
// 30 Nov 2026 23:59:59 IST = 30 Nov 2026 18:29:59 UTC (month end)
const endsAt = admin.firestore.Timestamp.fromDate(new Date('2026-11-30T18:29:59.000Z'))

const DOC = 'dashboardCampaign'
const ref = db.collection('config').doc(DOC)
const snap = await ref.get()
const existing = snap.exists ? snap.data() : {}

await ref.set(
  {
    ...existing,
    enabled: true,
    title: existing.title || 'November Mining Special Offer',
    subtitle: existing.subtitle || 'Diwali to New Year Campaign',
    bannerUrl: existing.bannerUrl || '/campaign-banner.jpg',
    startsAt,
    endsAt,
    maxShows: existing.maxShows ?? 0,
    requiredDirectReferrals: existing.requiredDirectReferrals ?? 3,
    volumeSource: existing.volumeSource || 'deposits_and_staking',
    tiers: existing.tiers?.length
      ? existing.tiers
      : [
          { id: 'thailand', name: 'Thailand Reward Trip', targetUsdCents: 250000, nightsLabel: '4 Days • 3 Nights', sortOrder: 1 },
          { id: 'vietnam', name: 'Vietnam Reward Trip', targetUsdCents: 400000, nightsLabel: '4 Days • 3 Nights', sortOrder: 2 },
          { id: 'dubai', name: 'Dubai Reward Trip', targetUsdCents: 500000, nightsLabel: '4 Days • 3 Nights', sortOrder: 3 },
          { id: 'singapore', name: 'Singapore Reward Trip', targetUsdCents: 600000, nightsLabel: '4 Days • 3 Nights', sortOrder: 4 },
        ],
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'cli:set-campaign-schedule',
  },
  { merge: true },
)

const saved = (await ref.get()).data()
const startMs = saved.startsAt.toDate()
const endMs = saved.endsAt.toDate()
console.log(
  JSON.stringify(
    {
      ok: true,
      enabled: saved.enabled,
      startsAtIST: startMs.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      endsAtIST: endMs.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      startsAtUTC: startMs.toISOString(),
      endsAtUTC: endMs.toISOString(),
      note: 'Progress counts only deposits/staking/referrals on or after startsAt',
    },
    null,
    2,
  ),
)
process.exit(0)
