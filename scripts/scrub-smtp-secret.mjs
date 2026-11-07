/**
 * Critical: migrate SMTP password out of world-readable config/smtp into secrets/smtp,
 * then delete the password field from config/smtp.
 *
 * Does NOT print the password.
 *
 * Usage: node scripts/scrub-smtp-secret.mjs
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

const configRef = db.collection('config').doc('smtp')
const secretRef = db.collection('secrets').doc('smtp')

const configSnap = await configRef.get()
const secretSnap = await secretRef.get()

const configData = configSnap.exists ? configSnap.data() : {}
const secretData = secretSnap.exists ? secretSnap.data() : {}

const legacyPassword =
  typeof configData?.password === 'string' && configData.password.length > 0
    ? configData.password
    : null
const secretPassword =
  typeof secretData?.password === 'string' && secretData.password.length > 0
    ? secretData.password
    : null

const hadLegacy = Boolean(legacyPassword)
const hadSecret = Boolean(secretPassword)

if (legacyPassword && !secretPassword) {
  await secretRef.set(
    {
      password: legacyPassword,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'scrub-smtp-secret',
    },
    { merge: true },
  )
  console.log('Migrated password from config/smtp → secrets/smtp')
} else if (legacyPassword && secretPassword) {
  console.log('secrets/smtp already has a password; not overwriting from legacy config field')
} else if (!legacyPassword && !secretPassword) {
  console.log('No password found on config/smtp or secrets/smtp — admin must set one after rotation')
} else {
  console.log('Password already only in secrets/smtp')
}

if (hadLegacy || Object.prototype.hasOwnProperty.call(configData || {}, 'password')) {
  await configRef.set({ password: admin.firestore.FieldValue.delete() }, { merge: true })
  console.log('Deleted password field from config/smtp')
}

const after = await configRef.get()
const afterData = after.exists ? after.data() : {}
const stillLeaking = typeof afterData?.password === 'string' && afterData.password.length > 0

console.log(
  JSON.stringify(
    {
      configExists: after.exists,
      passwordFieldPresent: Object.prototype.hasOwnProperty.call(afterData || {}, 'password'),
      passwordStillSet: stillLeaking,
      secretsHasPassword: hadSecret || hadLegacy,
      host: afterData?.host ?? null,
      username: afterData?.username ?? null,
      enabled: afterData?.enabled ?? null,
    },
    null,
    2,
  ),
)

if (stillLeaking) {
  console.error('FAILED: password still present on config/smtp')
  process.exit(1)
}

console.log('OK: config/smtp no longer stores a password. Rotate the mailbox password in GoDaddy next.')
