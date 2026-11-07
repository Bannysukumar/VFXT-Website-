/**
 * Upload a signed VFXT Wallet APK to Firebase Storage and publish download metadata.
 *
 * Usage:
 *   node scripts/publish-wallet-apk.mjs [path-to.apk] [versionName] [versionCode]
 *
 * Defaults: android app/app/build/outputs/apk/release/app-release.apk, 1.0.1, 2
 */
import { createHash, randomUUID } from 'node:crypto'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(path.join(root, 'functions/package.json'))
const admin = require('firebase-admin')

const saPath = path.join(root, 'vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json')
const sa = JSON.parse(readFileSync(saPath, 'utf8'))

const apkPath = path.resolve(
  process.argv[2] ||
    path.join(root, 'android app', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
)
const versionName = process.argv[3] || '1.0.1'
const versionCode = Number(process.argv[4] || 2)
const notes =
  process.argv[5] ||
  'Send fix: VFXT payment QRs and token Send no longer prefill the token contract as recipient.'

if (!Number.isInteger(versionCode) || versionCode < 1) {
  console.error('versionCode must be a positive integer')
  process.exit(1)
}

const sizeBytes = statSync(apkPath).size
if (sizeBytes <= 0 || sizeBytes > 80 * 1024 * 1024) {
  console.error(`APK size out of range: ${sizeBytes}`)
  process.exit(1)
}

const sha256 = await new Promise((resolve, reject) => {
  const hash = createHash('sha256')
  createReadStream(apkPath)
    .on('data', (chunk) => hash.update(chunk))
    .on('error', reject)
    .on('end', () => resolve(hash.digest('hex')))
})

const safeVersion = versionName.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.')
const fileName = `vfxt-wallet-${safeVersion}.apk`
const storagePath = `public/wallet-apk/${fileName}`
const downloadToken = randomUUID()
const bucketName = 'vfxt-a60d6.firebasestorage.app'

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    storageBucket: bucketName,
  })
}

const bucket = admin.storage().bucket()
console.log(`Uploading ${apkPath} (${(sizeBytes / (1024 * 1024)).toFixed(1)} MB) → gs://${bucketName}/${storagePath}`)

await bucket.upload(apkPath, {
  destination: storagePath,
  resumable: false,
  metadata: {
    contentType: 'application/vnd.android.package-archive',
    cacheControl: 'public,max-age=300',
    metadata: {
      firebaseStorageDownloadTokens: downloadToken,
      versionName,
      versionCode: String(versionCode),
      sha256,
    },
  },
})

const downloadUrl =
  `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/` +
  `${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`

const payload = {
  versionName,
  versionCode,
  fileName,
  downloadUrl,
  storagePath,
  sizeBytes,
  notes,
  sha256,
  publishedAt: admin.firestore.FieldValue.serverTimestamp(),
  publishedBy: 'admin-sdk-cli',
}

await admin.firestore().collection('config').doc('walletApk').set(payload, { merge: true })

console.log('Published wallet APK:')
console.log(JSON.stringify({ versionName, versionCode, fileName, sizeBytes, sha256, downloadUrl }, null, 2))
