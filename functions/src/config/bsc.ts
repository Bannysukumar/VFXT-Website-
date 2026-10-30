/** Binance Smart Chain (BEP-20) USDT configuration. */

export const BSC_CHAIN_ID = 56;

/** Binance-Peg USDT (BEP-20) on BSC mainnet. */
export const USDT_BEP20_ADDRESS = '0x55d398326f99059fF775485246999027B3197955';

/** USDT on BSC uses 18 decimals. */
export const USDT_DECIMALS = 18;

/** Default public RPC for reads. */
export const DEFAULT_BSC_RPC_URL = 'https://bsc-dataseed1.binance.org';

/** Public BSC RPC fallbacks (rotated on rate-limit / archive errors). */
export const BSC_RPC_URLS = [
  'https://bsc-dataseed1.binance.org',
  'https://bsc-dataseed2.binance.org',
  'https://bsc-dataseed3.binance.org',
  'https://1rpc.io/bnb',
  'https://bsc.publicnode.com',
  'https://bsc-rpc.publicnode.com',
  'https://rpc.ankr.com/bsc',
] as const;

/** Required confirmations before crediting a deposit. */
export const DEPOSIT_CONFIRMATIONS = 3;

/** How long a deposit QR / pending request stays open. */
export const DEPOSIT_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Scan this many recent blocks for Transfer events (~45–60 min on BSC). */
export const DEPOSIT_SCAN_BLOCKS = 1_200;

export const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
] as const;

/** Convert USD cents (2 decimals) → USDT wei (18 decimals), 1:1 USD≈USDT. */
export function usdCentsToUsdtWei(cents: number): bigint {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error('cents must be a positive integer');
  }
  // cents / 100 = USDT tokens; * 10^18 = wei
  return BigInt(cents) * 10n ** 16n;
}

/** Convert USDT wei → USD cents (floor). */
export function usdtWeiToUsdCents(wei: bigint): number {
  return Number(wei / 10n ** 16n);
}
