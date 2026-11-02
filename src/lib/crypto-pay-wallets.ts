/** Mobile / in-app deep links for BEP-20 token payments (PhonePe-style wallet chooser). */

export type CryptoPayParams = {
  depositAddress: string
  tokenAddress: string
  chainId: number
  amountWei: string
  /** Human amount, e.g. "12.340001" */
  amountUsdt: string
  /** Asset symbol shown in wallet deeplinks (USDT or VFXT). */
  symbol?: string
  /** EIP-681 payload from the server when available */
  eip681?: string | null
}

function paySymbol(p: CryptoPayParams): string {
  return (p.symbol || 'USDT').toUpperCase()
}

export type PayWalletOption = {
  id: string
  name: string
  /** Short label under the icon */
  subtitle: string
  /** Tailwind-ish solid brand color for the tile */
  color: string
  /** Letter / emoji glyph shown in the tile */
  glyph: string
  buildUrl: (p: CryptoPayParams) => string
  /** App store / download fallback */
  installUrl: string
  /** True when this wallet was detected in the browser / device. */
  detected?: boolean
}

function eip681(p: CryptoPayParams): string {
  if (p.eip681) return p.eip681
  return `ethereum:${p.tokenAddress}@${p.chainId}/transfer?address=${p.depositAddress}&uint256=${p.amountWei}`
}

/** Official VFXT Android wallet — opens Send prefilled via vfxtwallet://send. */
function vfxtWalletUrl(p: CryptoPayParams): string {
  const q = new URLSearchParams({
    address: p.depositAddress,
    amount: p.amountUsdt,
    token: p.tokenAddress,
    token_id: p.tokenAddress,
    chainId: String(p.chainId),
  })
  const schemeUrl = `vfxtwallet://send?${q.toString()}`
  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) {
    // Chrome Intent URL targets the installed package and falls back to /download.
    const fallback =
      typeof window !== 'undefined'
        ? `${window.location.origin}/download`
        : 'https://virtualfxtrades.com/download'
    return (
      `intent://send?${q.toString()}#Intent;` +
      `scheme=vfxtwallet;package=com.vfxt.wallet;` +
      `S.browser_fallback_url=${encodeURIComponent(fallback)};end`
    )
  }
  return schemeUrl
}

/** MetaMask universal link with token transfer. */
function metamaskUrl(p: CryptoPayParams): string {
  const path = `${p.tokenAddress}@${p.chainId}/transfer?address=${p.depositAddress}&uint256=${p.amountWei}`
  return `https://metamask.app.link/send/${path}`
}

/** Trust Wallet send deeplink (BSC coin = 20000714). */
function trustUrl(p: CryptoPayParams): string {
  const q = new URLSearchParams({
    coin: '20000714',
    address: p.depositAddress,
    amount: p.amountUsdt,
    token_id: p.tokenAddress,
  })
  return `https://link.trustwallet.com/send?${q.toString()}`
}

/** TokenPocket dapp / transfer open. */
function tokenPocketUrl(p: CryptoPayParams): string {
  const payload = encodeURIComponent(
    JSON.stringify({
      url: eip681(p),
      chain: 'BSC',
      source: 'vfxt',
    }),
  )
  return `tpdapp://open?params=${payload}`
}

/** OKX Wallet universal link. */
function okxUrl(p: CryptoPayParams): string {
  return `https://www.okx.com/download?deeplink=${encodeURIComponent(
    `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(eip681(p))}`,
  )}`
}

/** Bitget Wallet. */
function bitgetUrl(p: CryptoPayParams): string {
  const coin = paySymbol(p)
  return `bitkeep://bkconnect?action=send&coin=${coin}&chain=BSC&to=${p.depositAddress}&amount=${p.amountUsdt}`
}

/** SafePal. */
function safepalUrl(p: CryptoPayParams): string {
  const coin = paySymbol(p)
  return `safepalwallet://send?coin=${coin}&network=BSC&address=${p.depositAddress}&amount=${p.amountUsdt}`
}

/** Binance Web3 Wallet (falls back to EIP-681 via https open). */
function binanceUrl(p: CryptoPayParams): string {
  const coin = paySymbol(p)
  return `bnc://app.binance.com/cedefi/wallet?action=transfer&asset=${coin}&network=BSC&address=${p.depositAddress}&amount=${p.amountUsdt}`
}

/** imToken. */
function imTokenUrl(p: CryptoPayParams): string {
  const coin = paySymbol(p)
  return `imtokenv2://navigate/token?action=transfer&symbol=${coin}&to=${p.depositAddress}&amount=${p.amountUsdt}&blockchain=BSC`
}

export const PAY_WALLETS: PayWalletOption[] = [
  {
    id: 'vfxt',
    name: 'VFXT Wallet',
    subtitle: 'Official app',
    color: '#080D19',
    glyph: 'V',
    buildUrl: vfxtWalletUrl,
    installUrl: '/download',
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    subtitle: 'Browser & app',
    color: '#E2761B',
    glyph: '🦊',
    buildUrl: metamaskUrl,
    installUrl: 'https://metamask.io/download/',
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    subtitle: 'BSC token',
    color: '#0500FF',
    glyph: '🛡️',
    buildUrl: trustUrl,
    installUrl: 'https://trustwallet.com/download',
  },
  {
    id: 'tokenpocket',
    name: 'TokenPocket',
    subtitle: 'BEP-20',
    color: '#2980FE',
    glyph: 'TP',
    buildUrl: tokenPocketUrl,
    installUrl: 'https://www.tokenpocket.pro/en/download/app',
  },
  {
    id: 'okx',
    name: 'OKX Wallet',
    subtitle: 'Web3',
    color: '#000000',
    glyph: 'OKX',
    buildUrl: okxUrl,
    installUrl: 'https://www.okx.com/download',
  },
  {
    id: 'bitget',
    name: 'Bitget',
    subtitle: 'Wallet',
    color: '#00F0FF',
    glyph: 'BG',
    buildUrl: bitgetUrl,
    installUrl: 'https://web3.bitget.com/en/wallet-download',
  },
  {
    id: 'safepal',
    name: 'SafePal',
    subtitle: 'BSC',
    color: '#4A21EF',
    glyph: 'SP',
    buildUrl: safepalUrl,
    installUrl: 'https://www.safepal.com/download',
  },
  {
    id: 'binance',
    name: 'Binance',
    subtitle: 'Web3 Wallet',
    color: '#F0B90B',
    glyph: 'BNB',
    buildUrl: binanceUrl,
    installUrl: 'https://www.binance.com/en/download',
  },
  {
    id: 'imtoken',
    name: 'imToken',
    subtitle: 'BEP-20',
    color: '#11C4D1',
    glyph: 'im',
    buildUrl: imTokenUrl,
    installUrl: 'https://token.im/download',
  },
]

export function isLikelyMobile(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
}

export function isLikelyAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Android/i.test(navigator.userAgent)
}

type EthProviderFlags = {
  isMetaMask?: boolean
  isTrust?: boolean
  isTrustWallet?: boolean
  isTokenPocket?: boolean
  isOkxWallet?: boolean
  isBitKeep?: boolean
  isImToken?: boolean
  isCoinbaseWallet?: boolean
  providers?: EthProviderFlags[]
}

function readEthereum(): EthProviderFlags | null {
  if (typeof window === 'undefined') return null
  const eth = (window as Window & { ethereum?: EthProviderFlags }).ethereum
  return eth ?? null
}

/** Detect injected browser wallets (MetaMask, Trust, etc.). */
export function detectInjectedWalletIds(): Set<string> {
  const found = new Set<string>()
  const eth = readEthereum()
  if (!eth) return found

  const providers = Array.isArray(eth.providers) && eth.providers.length > 0 ? eth.providers : [eth]
  for (const p of providers) {
    if (p.isMetaMask) found.add('metamask')
    if (p.isTrust || p.isTrustWallet) found.add('trust')
    if (p.isTokenPocket) found.add('tokenpocket')
    if (p.isOkxWallet) found.add('okx')
    if (p.isBitKeep) found.add('bitget')
    if (p.isImToken) found.add('imtoken')
  }

  // Android Chrome often runs inside Trust / MetaMask in-app browsers.
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent
    if (/MetaMaskMobile/i.test(ua)) found.add('metamask')
    if (/Trust\//i.test(ua) || /TrustWallet/i.test(ua)) found.add('trust')
    if (/TokenPocket/i.test(ua)) found.add('tokenpocket')
    if (/VFXTWallet|vfxtwallet/i.test(ua)) found.add('vfxt')
  }

  // Official VFXT app is Android-only — highlight it on Android devices.
  if (isLikelyAndroid()) found.add('vfxt')

  return found
}

/** PAY_WALLETS with detected wallets flagged and sorted to the front. */
export function getDetectedPayWallets(): PayWalletOption[] {
  const detected = detectInjectedWalletIds()
  return [...PAY_WALLETS]
    .map((w) => ({ ...w, detected: detected.has(w.id) }))
    .sort((a, b) => Number(b.detected) - Number(a.detected) || 0)
}

/**
 * Open a wallet app with the payment prefilled.
 * Tries the deep link; if the page is still visible shortly after, offer install.
 */
export function openPayWallet(wallet: PayWalletOption, params: CryptoPayParams): void {
  const url = wallet.buildUrl(params)
  const started = Date.now()
  const install =
    wallet.installUrl.startsWith('/') && typeof window !== 'undefined'
      ? `${window.location.origin}${wallet.installUrl}`
      : wallet.installUrl

  // Prefer navigating away so mobile OS can hand off to the app
  window.location.href = url

  window.setTimeout(() => {
    // Still here ≈ app not installed / link ignored
    if (document.visibilityState === 'visible' && Date.now() - started < 2800) {
      window.open(install, '_blank', 'noopener,noreferrer')
    }
  }, 2200)
}
