/** Canonical VFXT BEP-20 facts used across public pages. */
export const VFXT_TOKEN = {
  name: 'VFXT',
  symbol: 'VFXT',
  decimals: 18,
  chainId: 56,
  networkLabel: 'BNB Smart Chain',
  /** Human-readable fixed supply (token units, not wei). */
  supply: '10,000,000,000,000',
  supplyShort: '10 trillion',
  /** Verified VFXTToken on BSC mainnet. */
  address: '0x4A08EF10e6f4aa077A74496793467d2192061969',
  /** Constructor treasury that received the full mint. */
  treasury: '0x76b16F59Cfab5DdaE5D149BE98E5d755F939572A',
  explorerUrl: 'https://bscscan.com/address/0x4A08EF10e6f4aa077A74496793467d2192061969',
  treasuryExplorerUrl: 'https://bscscan.com/address/0x76b16F59Cfab5DdaE5D149BE98E5d755F939572A',
} as const

export function shortAddress(address: string, chars = 4): string {
  if (address.length < chars * 2 + 2) return address
  return `${address.slice(0, 2 + chars)}…${address.slice(-chars)}`
}
