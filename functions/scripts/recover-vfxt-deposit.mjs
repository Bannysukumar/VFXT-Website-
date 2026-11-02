/**
 * Credit a pending deposit against a known tx hash.
 * Usage: node scripts/recover-vfxt-deposit.mjs <depositId> <txHash>
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  resolve(root, '..', 'vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json')
process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath
JSON.parse(readFileSync(keyPath, 'utf8'))

const admin = require('firebase-admin')
const { FieldValue } = require('firebase-admin/firestore')
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() })
}

const { verifyUsdtDepositTx } = require('../lib/modules/crypto/bsc-usdt')
const {
  depositWeiCandidates,
  resolveDepositExpectedWei,
} = require('../lib/modules/crypto/unique-amount')
const { applyLedgerEntries } = require('../lib/modules/wallets/ledger')
const { walletDocId } = require('../lib/modules/wallets/types')
const { ensureUserWallets } = require('../lib/modules/wallets/handlers')
const { getTokenEconomicsSettings } = require('../lib/modules/platform/store')
const { vfxtTokensToFundCents } = require('../lib/config/plan')
const { getDb } = require('../lib/lib/firebase')

const depositId = process.argv[2]
const txHashArg = process.argv[3]
if (!depositId || !txHashArg) {
  console.error('Usage: node scripts/recover-vfxt-deposit.mjs <depositId> <txHash>')
  process.exit(1)
}

const db = getDb()
const snap = await db.collection('deposits').doc(depositId).get()
if (!snap.exists) throw new Error('deposit missing')
const dep = snap.data()
console.log('deposit', depositId, dep.status, dep.amountMinor, dep.method)

const found = await verifyUsdtDepositTx({
  txHash: txHashArg,
  expectedWei: resolveDepositExpectedWei(dep),
  acceptedWeis: depositWeiCandidates(dep),
  notBeforeMs: dep.createdAt.toMillis() - 60_000,
  toAddress: dep.depositAddress,
  tokenAddress: dep.tokenAddress,
  tokenSymbol: dep.tokenSymbol || 'VFXT',
  tokenDecimals: 18,
  isTxUsed: async (txHash) => {
    const used = await db.collection('usedCryptoTx').doc(txHash.toLowerCase()).get()
    return used.exists
  },
})
console.log('found', found)
if (!found) process.exit(2)

const tokenFx = await getTokenEconomicsSettings()
const isVfxt = dep.method === 'vfxt_bep20' || dep.tokenSymbol === 'VFXT'
const fundCents = isVfxt
  ? vfxtTokensToFundCents(Number(dep.amountMinor), tokenFx.tokensPerUsd)
  : Number(dep.amountMinor)
await ensureUserWallets(db, dep.userId)

const txRef = db.collection('usedCryptoTx').doc(found.txHash.toLowerCase())
const depositRef = db.collection('deposits').doc(depositId)
const fundWalletId = walletDocId(dep.userId, 'fund')

await db.runTransaction(async (tx) => {
  if ((await tx.get(txRef)).exists) throw new Error('already used')
  const status = (await tx.get(depositRef)).data().status
  if (!['pending', 'awaiting_payment'].includes(status)) {
    throw new Error('bad status ' + status)
  }
  await applyLedgerEntries(tx, db, [
    {
      userId: dep.userId,
      walletId: fundWalletId,
      type: 'deposit_credit',
      direction: 'credit',
      amountMinor: fundCents,
      availableDelta: fundCents,
      reservedDelta: 0,
      currency: 'USD',
      referenceType: 'deposit',
      referenceId: depositId,
      description: `${dep.tokenSymbol || 'TOKEN'} deposit recovery → Fund`,
      createdBy: 'system:manual-recovery',
      metadata: { txHash: found.txHash, paidTokens: isVfxt ? dep.amountMinor : null },
    },
  ])
  tx.set(txRef, {
    txHash: found.txHash.toLowerCase(),
    depositId,
    userId: dep.userId,
    createdAt: FieldValue.serverTimestamp(),
  })
  tx.update(depositRef, {
    status: 'completed',
    walletId: fundWalletId,
    currency: 'USD',
    txHash: found.txHash,
    vfxtTokensCredited: 0,
    fundCentsCredited: fundCents,
    reviewedBy: 'system:manual-recovery',
    reviewedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
})

console.log('credited ok', found.txHash, 'fundCents', fundCents)
