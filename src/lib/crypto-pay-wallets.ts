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

function metamaskUrl(p: CryptoPayParams): string {
  const path = `${p.tokenAddress}@${p.chainId}/transfer?address=${p.depositAddress}&uint256=${p.amountWei}`
  return `https://metamask.app.link/send/${path}`
}

function trustUrl(p: CryptoPayParams): string {
  const q = new URLSearchParams({
    coin: '20000714',
    address: p.depositAddress,
    amount: p.amountUsdt,
    token_id: p.tokenAddress,
  })
  return `https://link.trustwallet.com/send?${q.toString()}`
}

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

function okxUrl(p: CryptoPayParams): string {
  return `https://www.okx.com/download?deeplink=${encodeURIComponent(
    `okx://wallet/dapp/url?dappUrl=${encodeURIComponent(eip681(p))}`,
  )}`
}

function bitgetUrl(p: CryptoPayParams): string {
  const coin = paySymbol(p)
  return `bitkeep://bkconnect?action=send&coin=${coin}&chain=BSC&to=${p.depositAddress}&amount=${p.amountUsdt}`
}

function safepalUrl(p: CryptoPayParams): string {
  const coin = paySymbol(p)
  return `safepalwallet://send?coin=${coin}&network=BSC&address=${p.depositAddress}&amount=${p.amountUsdt}`
}

function binanceUrl(p: CryptoPayParams): string {
  const coin = paySymbol(p)
  return `bnc://app.binance.com/cedefi/wallet?action=transfer&asset=${coin}&network=BSC&address=${p.depositAddress}&amount=${p.amountUsdt}`
}

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
    glyph: 'MM',
    buildUrl: metamaskUrl,
    installUrl: 'https://metamask.io/download/',
  },
  {
    id: 'trust',
    name: 'Trust Wallet',
    subtitle: 'BSC token',
    color: '#0500FF',
    glyph: 'TW',
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
    color: '#111111',
    glyph: 'OKX',
    buildUrl: okxUrl,
    installUrl: 'https://www.okx.com/download',
  },
  {
    id: 'bitget',
    name: 'Bitget',
    subtitle: 'Wallet',
    color: '#1BC29B',
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
  isOKExWallet?: boolean
  isBitKeep?: boolean
  isBitget?: boolean
  isImToken?: boolean
  isSafePal?: boolean
  isBinance?: boolean
  isCoinbaseWallet?: boolean
  providers?: EthProviderFlags[]
}

type BrowserWindow = Window & {
  ethereum?: EthProviderFlags
  okxwallet?: EthProviderFlags
  okexchain?: EthProviderFlags
  bitkeep?: { ethereum?: EthProviderFlags }
  safepal?: EthProviderFlags
  safepalProvider?: EthProviderFlags
  BinanceChain?: EthProviderFlags
  tokenpocket?: EthProviderFlags
  imToken?: EthProviderFlags
  trustwallet?: EthProviderFlags
  vfxtwallet?: unknown
}

function readWindow(): BrowserWindow | null {
  if (typeof window === 'undefined') return null
  return window as BrowserWindow
}

function collectProviders(win: BrowserWindow): EthProviderFlags[] {
  const list: EthProviderFlags[] = []
  const push = (p?: EthProviderFlags | null) => {
    if (p && !list.includes(p)) list.push(p)
  }

  const eth = win.ethereum
  if (eth) {
    if (Array.isArray(eth.providers) && eth.providers.length > 0) {
      for (const p of eth.providers) push(p)
    } else {
      push(eth)
    }
  }
  push(win.okxwallet)
  push(win.okexchain)
  push(win.bitkeep?.ethereum)
  push(win.safepal)
  push(win.safepalProvider)
  push(win.BinanceChain)
  push(win.tokenpocket)
  push(win.imToken)
  push(win.trustwallet)
  return list
}

function markFromProvider(found: Set<string>, p: EthProviderFlags): void {
  // MetaMask extension sets isMetaMask; exclude multi-flags that also claim it.
  if (p.isMetaMask && !p.isTokenPocket && !p.isTrust && !p.isTrustWallet && !p.isOkxWallet && !p.isBitKeep) {
    found.add('metamask')
  } else if (p.isMetaMask) {
    found.add('metamask')
  }
  if (p.isTrust || p.isTrustWallet) found.add('trust')
  if (p.isTokenPocket) found.add('tokenpocket')
  if (p.isOkxWallet || p.isOKExWallet) found.add('okx')
  if (p.isBitKeep || p.isBitget) found.add('bitget')
  if (p.isImToken) found.add('imtoken')
  if (p.isSafePal) found.add('safepal')
  if (p.isBinance) found.add('binance')
}

/**
 * Detect wallets that are actually available in this browser / in-app WebView.
 * Browsers cannot see native apps that are not injected — we never pretend they are installed.
 */
export function detectInjectedWalletIds(): Set<string> {
  const found = new Set<string>()
  const win = readWindow()
  if (!win) return found

  for (const p of collectProviders(win)) {
    markFromProvider(found, p)
  }

  // Named globals (even when not listed under ethereum.providers).
  if (win.okxwallet || win.okexchain) found.add('okx')
  if (win.bitkeep?.ethereum) found.add('bitget')
  if (win.safepal || win.safepalProvider) found.add('safepal')
  if (win.BinanceChain) found.add('binance')
  if (win.tokenpocket) found.add('tokenpocket')
  if (win.imToken) found.add('imtoken')
  if (win.trustwallet) found.add('trust')
  if (win.vfxtwallet) found.add('vfxt')

  // In-app browser user agents (reliable install signal).
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent
    if (/MetaMaskMobile/i.test(ua)) found.add('metamask')
    if (/Trust\/|TrustWallet/i.test(ua)) found.add('trust')
    if (/TokenPocket/i.test(ua)) found.add('tokenpocket')
    if (/OKApp|OKEx/i.test(ua)) found.add('okx')
    if (/BitKeep|Bitget/i.test(ua)) found.add('bitget')
    if (/SafePal/i.test(ua)) found.add('safepal')
    if (/Binance/i.test(ua) && /WebView|BNB/i.test(ua)) found.add('binance')
    if (/imToken/i.test(ua)) found.add('imtoken')
    // Only mark VFXT when the official WebView / bridge is present — never all Android.
    if (/VFXTWallet|vfxtwallet/i.test(ua)) found.add('vfxt')
  }

  return found
}

/** True when any injected Ethereum provider is available for Connect & send. */
export function hasInjectedEthereum(): boolean {
  const win = readWindow()
  if (!win) return false
  return Boolean(win.ethereum || win.okxwallet || win.bitkeep?.ethereum || win.BinanceChain)
}

/** All catalog wallets with detection flags (legacy helper). */
export function getDetectedPayWallets(): PayWalletOption[] {
  const detected = detectInjectedWalletIds()
  return [...PAY_WALLETS]
    .map((w) => ({ ...w, detected: detected.has(w.id) }))
    .sort((a, b) => Number(b.detected) - Number(a.detected) || 0)
}

/** Only wallets confirmed installed / injected in this browser. */
export function getInstalledPayWallets(): PayWalletOption[] {
  const detected = detectInjectedWalletIds()
  return PAY_WALLETS.filter((w) => detected.has(w.id)).map((w) => ({
    ...w,
    detected: true,
  }))
}

/** Catalog wallets that are NOT installed — for optional download links only. */
export function getMissingPayWallets(): PayWalletOption[] {
  const detected = detectInjectedWalletIds()
  return PAY_WALLETS.filter((w) => !detected.has(w.id)).map((w) => ({
    ...w,
    detected: false,
  }))
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

  window.location.href = url

  window.setTimeout(() => {
    if (document.visibilityState === 'visible' && Date.now() - started < 2800) {
      window.open(install, '_blank', 'noopener,noreferrer')
    }
  }, 2200)
}
