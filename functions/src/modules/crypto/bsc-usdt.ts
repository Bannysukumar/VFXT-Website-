import {
  Contract,
  JsonRpcProvider,
  Wallet,
  formatUnits,
  getAddress,
  id,
  zeroPadValue,
} from 'ethers';
import {
  BSC_CHAIN_ID,
  DEPOSIT_CONFIRMATIONS,
  DEPOSIT_SCAN_BLOCKS,
  ERC20_ABI,
  USDT_BEP20_ADDRESS,
  USDT_DECIMALS,
  usdCentsToUsdtWei,
  usdtWeiToUsdCents,
  BSC_RPC_URLS,
} from '../../config/bsc';
import { AppError } from '../../lib/errors';
import { log } from '../../lib/logger';
import { getHotWallet } from './hot-wallet';

const LOG_CHUNK_BLOCKS = 500;

export function assertBep20Address(address: string): string {
  try {
    return getAddress(address.trim());
  } catch {
    throw new AppError('invalid-argument', 'Invalid BEP-20 wallet address');
  }
}

function isTransientRpcError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('rate limit') ||
    msg.includes('-32005') ||
    msg.includes('-32602') ||
    msg.includes('429') ||
    msg.includes('missing response for request') ||
    msg.includes('limit exceeded') ||
    msg.includes('Archive requests require') ||
    msg.includes('personal token') ||
    msg.includes('no available upstreams') ||
    msg.includes('could not coalesce error')
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildProvider(rpcUrl: string): JsonRpcProvider {
  // Disable JSON-RPC batching — public BSC seeds rate-limit batched eth_getLogs.
  return new JsonRpcProvider(rpcUrl, BSC_CHAIN_ID, {
    staticNetwork: true,
    batchMaxCount: 1,
  });
}

async function withRpcFallback<T>(
  preferredUrl: string | undefined,
  fn: (provider: JsonRpcProvider) => Promise<T>,
): Promise<T> {
  const urls = [
    preferredUrl,
    ...BSC_RPC_URLS,
  ].filter((u, i, arr): u is string => Boolean(u) && arr.indexOf(u) === i);

  let lastError: unknown;
  for (const url of urls) {
    const provider = buildProvider(url);
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await fn(provider);
      } catch (err) {
        lastError = err;
        if (isTransientRpcError(err) && attempt === 0) {
          await sleep(400 + Math.floor(Math.random() * 400));
          continue;
        }
        if (isTransientRpcError(err)) {
          log.warn('bsc_rpc_rate_limited', { rpcUrl: url });
          break;
        }
        throw err;
      }
    }
  }

  throw new AppError(
    'unavailable',
    'BSC RPC temporarily rate-limited. Please retry in a moment.',
    { cause: lastError instanceof Error ? lastError.message : String(lastError) },
  );
}

export async function getHotWalletUsdtBalance(): Promise<{
  address: string;
  balanceUsdt: string;
  balanceWei: string;
}> {
  const hot = await getHotWallet();
  return withRpcFallback(hot.rpcUrl, async (provider) => {
    const token = new Contract(USDT_BEP20_ADDRESS, ERC20_ABI, provider);
    const bal = (await token.balanceOf(hot.address)) as bigint;
    return {
      address: hot.address,
      balanceUsdt: formatUnits(bal, USDT_DECIMALS),
      balanceWei: bal.toString(),
    };
  });
}

/** Prefer broadcast-friendly RPCs for signing/sending (avoid PublicNode archive quirks). */
const BROADCAST_RPC_URLS = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://1rpc.io/bnb',
  ...BSC_RPC_URLS,
] as const;

export async function waitForTxReceipt(
  txHash: string,
  confirmations = 1,
): Promise<{ hash: string; status: number; blockNumber: number }> {
  const urls = [...new Set([...BROADCAST_RPC_URLS, ...BSC_RPC_URLS])];
  let lastError: unknown;

  for (let attempt = 0; attempt < 45; attempt++) {
    for (const url of urls) {
      try {
        const provider = buildProvider(url);
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt) continue;
        if (receipt.status !== 1) {
          throw new AppError('internal', 'USDT transfer reverted on-chain');
        }
        const latest = await provider.getBlockNumber();
        if (latest - receipt.blockNumber + 1 >= confirmations) {
          return {
            hash: receipt.hash,
            status: Number(receipt.status),
            blockNumber: receipt.blockNumber,
          };
        }
      } catch (err) {
        lastError = err;
        if (err instanceof AppError) throw err;
        if (!isTransientRpcError(err)) {
          log.warn('receipt_poll_error', {
            rpcUrl: url,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
    await sleep(1200);
  }

  throw new AppError(
    'unavailable',
    `Timed out waiting for tx receipt ${txHash}`,
    { cause: lastError instanceof Error ? lastError.message : String(lastError) },
  );
}

/** Send USDT BEP-20 from the hot wallet. Returns tx hash. */
export async function sendUsdtBep20(params: {
  to: string;
  amountUsdCents: number;
}): Promise<{ txHash: string; amountWei: string }> {
  const to = assertBep20Address(params.to);
  const amountWei = usdCentsToUsdtWei(params.amountUsdCents);
  const hot = await getHotWallet();

  // Broadcast via Binance seeds first — PublicNode often fails on receipt polling.
  let txHash: string | null = null;
  let lastBroadcastError: unknown;

  for (const url of [...new Set([hot.rpcUrl, ...BROADCAST_RPC_URLS])]) {
    try {
      const provider = buildProvider(url);
      const signer = new Wallet(hot.privateKey, provider);
      if (signer.address.toLowerCase() !== hot.address.toLowerCase()) {
        throw new AppError('internal', 'Hot wallet key/address mismatch');
      }

      const token = new Contract(USDT_BEP20_ADDRESS, ERC20_ABI, signer);
      const bal = (await token.balanceOf(signer.address)) as bigint;
      if (bal < amountWei) {
        throw new AppError(
          'failed-precondition',
          `Hot wallet USDT balance too low (have ${formatUnits(bal, USDT_DECIMALS)})`,
        );
      }

      log.info('usdt_bep20_send_start', {
        to,
        amountWei: amountWei.toString(),
        from: signer.address,
        rpcUrl: url,
      });

      const tx = await token.transfer(to, amountWei);
      txHash = tx.hash;
      break;
    } catch (err) {
      lastBroadcastError = err;
      if (err instanceof AppError && err.code !== 'unavailable') throw err;
      // If nonce/already-known, the tx may already be in flight — fall through to receipt wait if we have a hash.
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('already known') || msg.includes('nonce too low')) {
        log.warn('usdt_broadcast_possible_inflight', { rpcUrl: url, error: msg });
      }
      if (!isTransientRpcError(err) && !(err instanceof AppError)) {
        // Keep trying other RPCs for transient network issues only.
        log.warn('usdt_broadcast_rpc_failed', { rpcUrl: url, error: msg });
      }
    }
  }

  if (!txHash) {
    throw new AppError(
      'internal',
      `USDT broadcast failed: ${
        lastBroadcastError instanceof Error
          ? lastBroadcastError.message
          : String(lastBroadcastError)
      }`,
    );
  }

  const receipt = await waitForTxReceipt(txHash, 1);
  return { txHash: receipt.hash, amountWei: amountWei.toString() };
}

export interface DetectedDeposit {
  txHash: string;
  from: string;
  to: string;
  amountWei: bigint;
  amountUsdCents: number;
  blockNumber: number;
  confirmations: number;
}

async function getLogsChunked(
  provider: JsonRpcProvider,
  filter: {
    address: string;
    topics: (string | null)[];
    fromBlock: number;
    toBlock: number;
  },
): Promise<Awaited<ReturnType<JsonRpcProvider['getLogs']>>> {
  const out: Awaited<ReturnType<JsonRpcProvider['getLogs']>> = [];
  for (let start = filter.fromBlock; start <= filter.toBlock; start += LOG_CHUNK_BLOCKS) {
    const end = Math.min(filter.toBlock, start + LOG_CHUNK_BLOCKS - 1);
    const chunk = await provider.getLogs({
      address: filter.address,
      fromBlock: start,
      toBlock: end,
      topics: filter.topics,
    });
    out.push(...chunk);
    // Small pause between chunks to avoid public RPC rate limits.
    if (end < filter.toBlock) await sleep(80);
  }
  return out;
}

async function parseMatchingTransferLog(
  provider: JsonRpcProvider,
  entry: Awaited<ReturnType<JsonRpcProvider['getLogs']>>[number],
  params: {
    hotAddress: string;
    expectedWei: bigint;
    notBeforeMs: number;
    latest: number;
    isTxUsed: (txHash: string) => Promise<boolean>;
  },
): Promise<DetectedDeposit | null> {
  const txHash = entry.transactionHash;
  if (await params.isTxUsed(txHash)) return null;

  const amountWei = BigInt(entry.data);
  if (amountWei !== params.expectedWei) return null;

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt || receipt.status !== 1) return null;

  const block = await provider.getBlock(receipt.blockNumber);
  if (!block || block.timestamp * 1000 < params.notBeforeMs) return null;

  const confirmations = params.latest - receipt.blockNumber + 1;
  if (confirmations < DEPOSIT_CONFIRMATIONS) return null;

  const from = getAddress('0x' + (entry.topics[1] ?? '').slice(26));

  return {
    txHash,
    from,
    to: params.hotAddress,
    amountWei,
    amountUsdCents: usdtWeiToUsdCents(amountWei),
    blockNumber: receipt.blockNumber,
    confirmations,
  };
}

/**
 * Verify a client-supplied tx hash against chain (token, to, amount, status).
 */
export async function verifyUsdtDepositTx(params: {
  txHash: string;
  expectedWei: bigint;
  notBeforeMs: number;
  isTxUsed: (txHash: string) => Promise<boolean>;
  /** Deposit-assigned receive address (required for multi-wallet pools). */
  toAddress?: string;
}): Promise<DetectedDeposit | null> {
  const hot = await getHotWallet();
  const { getHotWalletByAddress } = await import('./hot-wallet');
  const receiveAddress = getAddress(params.toAddress || hot.address);
  const bound = await getHotWalletByAddress(receiveAddress);
  const rpcUrl = bound?.rpcUrl || hot.rpcUrl;
  if (await params.isTxUsed(params.txHash)) return null;

  return withRpcFallback(rpcUrl, async (provider) => {
    const receipt = await provider.getTransactionReceipt(params.txHash);
    if (!receipt || receipt.status !== 1) {
      throw new AppError('failed-precondition', 'Transaction not found or failed on BSC');
    }

    const latest = await provider.getBlockNumber();
    const confirmations = latest - receipt.blockNumber + 1;
    if (confirmations < DEPOSIT_CONFIRMATIONS) {
      throw new AppError(
        'failed-precondition',
        `Waiting for confirmations (${confirmations}/${DEPOSIT_CONFIRMATIONS})`,
      );
    }

    const transferTopic = id('Transfer(address,address,uint256)');
    const toTopic = zeroPadValue(receiveAddress, 32);
    const logs = await provider.getLogs({
      address: USDT_BEP20_ADDRESS,
      fromBlock: receipt.blockNumber,
      toBlock: receipt.blockNumber,
      topics: [transferTopic, null, toTopic],
    });

    const match = logs.find((entry) => entry.transactionHash.toLowerCase() === params.txHash.toLowerCase());
    if (!match) {
      throw new AppError(
        'failed-precondition',
        'Tx has no USDT transfer to the deposit address',
      );
    }

    const amountWei = BigInt(match.data);
    if (amountWei !== params.expectedWei) {
      throw new AppError(
        'failed-precondition',
        `Amount mismatch: got ${formatUnits(amountWei, USDT_DECIMALS)} USDT`,
      );
    }

    const block = await provider.getBlock(receipt.blockNumber);
    if (!block || block.timestamp * 1000 < params.notBeforeMs) {
      throw new AppError('failed-precondition', 'Transaction is outside the deposit window');
    }

    return {
      txHash: match.transactionHash,
      from: getAddress('0x' + (match.topics[1] ?? '').slice(26)),
      to: receiveAddress,
      amountWei,
      amountUsdCents: usdtWeiToUsdCents(amountWei),
      blockNumber: receipt.blockNumber,
      confirmations,
    };
  });
}

/**
 * Scan recent Transfer events to the hot wallet for an exact USDT amount (wei).
 * Never trusts a client-supplied tx hash alone — chain, token, to, amount, status verified.
 */
export async function findIncomingUsdtTransfer(params: {
  expectedWei: bigint;
  notBeforeMs: number;
  isTxUsed: (txHash: string) => Promise<boolean>;
  /** Deposit-assigned receive address (required for multi-wallet pools). */
  toAddress?: string;
}): Promise<DetectedDeposit | null> {
  const hot = await getHotWallet();
  const { getHotWalletByAddress } = await import('./hot-wallet');
  const receiveAddress = getAddress(params.toAddress || hot.address);
  const bound = await getHotWalletByAddress(receiveAddress);
  const rpcUrl = bound?.rpcUrl || hot.rpcUrl;

  return withRpcFallback(rpcUrl, async (provider) => {
    const latest = await provider.getBlockNumber();
    const fromBlock = Math.max(0, latest - DEPOSIT_SCAN_BLOCKS);

    const transferTopic = id('Transfer(address,address,uint256)');
    const toTopic = zeroPadValue(receiveAddress, 32);

    const logs = await getLogsChunked(provider, {
      address: USDT_BEP20_ADDRESS,
      fromBlock,
      toBlock: latest,
      topics: [transferTopic, null, toTopic],
    });

    for (const entry of logs.reverse()) {
      const found = await parseMatchingTransferLog(provider, entry, {
        hotAddress: receiveAddress,
        expectedWei: params.expectedWei,
        notBeforeMs: params.notBeforeMs,
        latest,
        isTxUsed: params.isTxUsed,
      });
      if (found) return found;
    }

    return null;
  });
}

export { usdCentsToUsdtWei, USDT_BEP20_ADDRESS, BSC_CHAIN_ID };
