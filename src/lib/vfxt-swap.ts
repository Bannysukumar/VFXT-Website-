import { VFXT_TOKEN } from '@/lib/vfxt-token'

/** Live VFXTSwap desk on BNB Smart Chain. */
export const VFXT_SWAP = {
  address: '0xD0fe8d149D4Cb91Bc30036f8c0C799859C0A1F24',
  chainId: 56,
  networkLabel: 'BNB Smart Chain',
  explorerUrl: 'https://bscscan.com/address/0xD0fe8d149D4Cb91Bc30036f8c0C799859C0A1F24',
  vfxt: VFXT_TOKEN.address,
  usdt: '0x55d398326f99059fF775485246999027B3197955',
  /** Default admin / owner wallet used at deploy. */
  admin: VFXT_TOKEN.treasury,
} as const

export const VFXT_SWAP_ABI = [
  'function owner() view returns (address)',
  'function priceManager() view returns (address)',
  'function buyPrice() view returns (uint256)',
  'function sellPrice() view returns (uint256)',
  'function paused() view returns (bool)',
  'function vfxt() view returns (address)',
  'function usdt() view returns (address)',
  'function reserves() view returns (uint256 vfxtBalance, uint256 usdtBalance)',
  'function minUsdtPerTrade() view returns (uint256)',
  'function maxUsdtPerTrade() view returns (uint256)',
  'function setPrices(uint256 newBuyPrice, uint256 newSellPrice)',
  'function setPriceManager(address newManager)',
  'function setTradeLimits(uint256 minUsdt, uint256 maxUsdt)',
  'function deposit(address token, uint256 amount)',
  'function withdraw(address token, address to, uint256 amount)',
  'function withdrawAll(address token, address to)',
  'function pause()',
  'function unpause()',
] as const

export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const

export function resolveSwapAddress(envAddress?: string | null): string {
  const fromEnv = envAddress?.trim()
  return fromEnv || VFXT_SWAP.address
}
