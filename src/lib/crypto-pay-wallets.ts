/** Mobile / in-app deep links for BEP-20 USDT payments (PhonePe-style wallet chooser). */

export type CryptoPayParams = {
  depositAddress: string
  tokenAddress: string
  chainId: number
  amountWei: string
  /** Human amount, e.g. "12.340001" */
  amountUsdt: string
  /** EIP-681 payload from the server when available */
  eip681?: string | null
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
}

function eip681(p: CryptoPayParams): string {
  if (p.eip681) return p.eip681
  return `ethereum:${p.tokenAddress}@${p.chainId}/transfer?address=${p.depositAddress}&uint256=${p.amountWei}`
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
  return `bitkeep://bkconnect?action=send&coin=USDT&chain=BSC&to=${p.depositAddress}&amount=${p.amountUsdt}`
}

/** SafePal. */
function safepalUrl(p: CryptoPayParams): string {
  return `safepalwallet://send?coin=USDT&network=BSC&address=${p.depositAddress}&amount=${p.amountUsdt}`
}

/** Binance Web3 Wallet (falls back to EIP-681 via https open). */
function binanceUrl(p: CryptoPayParams): string {
  return `bnc://app.binance.com/cedefi/wallet?action=transfer&asset=USDT&network=BSC&address=${p.depositAddress}&amount=${p.amountUsdt}`
}

/** imToken. */
function imTokenUrl(p: CryptoPayParams): string {
  return `imtokenv2://navigate/token?action=transfer&symbol=USDT&to=${p.depositAddress}&amount=${p.amountUsdt}&blockchain=BSC`
}

export const PAY_WALLETS: PayWalletOption[] = [
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
    subtitle: 'BSC USDT',
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
    subtitle: 'USDT',
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

/**
 * Open a wallet app with the payment prefilled.
 * Tries the deep link; if the page is still visible shortly after, offer install.
 */
export function openPayWallet(wallet: PayWalletOption, params: CryptoPayParams): void {
  const url = wallet.buildUrl(params)
  const started = Date.now()
  // Prefer navigating away so mobile OS can hand off to the app
  window.location.href = url

  window.setTimeout(() => {
    // Still here ≈ app not installed / link ignored
    if (document.visibilityState === 'visible' && Date.now() - started < 2800) {
      window.open(wallet.installUrl, '_blank', 'noopener,noreferrer')
    }
  }, 2200)
}
