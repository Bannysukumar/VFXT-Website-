/**
 * One-off: credit pending USDT deposits that already landed on-chain.
 * Usage: node scripts/credit-pending-crypto-deposits.mjs
 */
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const { JsonRpcProvider, id, zeroPadValue, getAddress } = require('ethers');
const admin = require('firebase-admin');

const __dirname = dirname(fileURLToPath(import.meta.url));
const cred = JSON.parse(
  readFileSync(join(__dirname, '../../vfxt-a60d6-firebase-adminsdk-fbsvc-bb22a4caad.json'), 'utf8'),
);

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(cred) });
}
const db = admin.firestore();

const USDT = '0x55d398326f99059fF775485246999027B3197955';
const TO = '0x76b16F59Cfab5DdaE5D149BE98E5d755F939572A';
const RPC = 'https://bsc.publicnode.com';

function usdCentsToUsdtWei(cents) {
  return BigInt(cents) * 10n ** 16n;
}

async function creditDeposit({ depositId, txHash, from, amountMinor, userId, walletId }) {
  const txRef = db.collection('usedCryptoTx').doc(txHash.toLowerCase());
  const depositRef = db.collection('deposits').doc(depositId);

  await db.runTransaction(async (tx) => {
    const used = await tx.get(txRef);
    if (used.exists) throw new Error(`tx already used: ${txHash}`);
    const dep = await tx.get(depositRef);
    if (!dep.exists) throw new Error('deposit missing');
    const data = dep.data();
    if (data.status !== 'pending' && data.status !== 'awaiting_payment') {
      throw new Error(`bad status ${data.status}`);
    }

    const walletRef = db.collection('wallets').doc(walletId);
    const walletSnap = await tx.get(walletRef);
    if (!walletSnap.exists) throw new Error('wallet missing');
    const wallet = walletSnap.data();
    const nextAvailable = wallet.availableMinor + amountMinor;

    const entryId = `manual_${depositId}`;
    tx.set(db.collection('ledger').doc(entryId), {
      entryId,
      userId,
      walletId,
      type: 'deposit_credit',
      direction: 'credit',
      amountMinor,
      balanceAfterAvailableMinor: nextAvailable,
      balanceAfterReservedMinor: wallet.reservedMinor,
      currency: 'USD',
      referenceType: 'deposit',
      referenceId: depositId,
      description: `USDT BEP-20 deposit ${txHash.slice(0, 10)}…`,
      metadata: { txHash, from, chainId: 56, token: USDT, creditedBy: 'manual-script' },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: 'system:manual-credit',
    });
    tx.update(walletRef, {
      availableMinor: nextAvailable,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.set(txRef, {
      txHash: txHash.toLowerCase(),
      depositId,
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    tx.update(depositRef, {
      status: 'completed',
      method: 'usdt_bep20',
      txHash,
      reviewedBy: 'system:manual-credit',
      reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });
}

async function main() {
  await db.collection('secrets').doc('cryptoHotWallet').update({ rpcUrl: RPC });

  const provider = new JsonRpcProvider(RPC, 56, { staticNetwork: true, batchMaxCount: 1 });
  const latest = await provider.getBlockNumber();
  const fromBlock = latest - 3000;
  const transferTopic = id('Transfer(address,address,uint256)');
  const toTopic = zeroPadValue(TO, 32);
  const logs = [];
  for (let s = fromBlock; s <= latest; s += 500) {
    const e = Math.min(latest, s + 499);
    logs.push(
      ...(await provider.getLogs({
        address: USDT,
        fromBlock: s,
        toBlock: e,
        topics: [transferTopic, null, toTopic],
      })),
    );
  }

  const pending = await db
    .collection('deposits')
    .where('method', '==', 'usdt_bep20')
    .where('status', 'in', ['pending', 'awaiting_payment'])
    .get();

  console.log('on-chain transfers', logs.length, 'pending deposits', pending.size);

  const unused = [];
  for (const entry of logs) {
    const used = await db.collection('usedCryptoTx').doc(entry.transactionHash.toLowerCase()).get();
    if (!used.exists) {
      unused.push({
        txHash: entry.transactionHash,
        from: getAddress('0x' + entry.topics[1].slice(26)),
        wei: BigInt(entry.data),
        block: entry.blockNumber,
      });
    }
  }

  for (const depDoc of pending.docs) {
    const dep = depDoc.data();
    const expected = usdCentsToUsdtWei(Number(dep.amountMinor));
    const match = unused.find((u) => u.wei === expected);
    if (!match) {
      console.log('no match yet for', depDoc.id, 'amountMinor', dep.amountMinor);
      continue;
    }
    unused.splice(unused.indexOf(match), 1);
    await creditDeposit({
      depositId: depDoc.id,
      txHash: match.txHash,
      from: match.from,
      amountMinor: Number(dep.amountMinor),
      userId: dep.userId,
      walletId: dep.walletId,
    });
    console.log('credited', depDoc.id, match.txHash, Number(dep.amountMinor) / 100, 'USDT');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
