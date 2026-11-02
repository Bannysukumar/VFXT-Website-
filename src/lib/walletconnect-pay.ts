import { BrowserProvider, JsonRpcSigner } from 'ethers'
import { ensureBscNetwork } from '@/lib/evm-wallet'

type EvmRequestProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

const BSC_CHAIN_ID = 56

let cachedWcProvider: {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  accounts: string[]
  enable: () => Promise<unknown>
  disconnect?: () => Promise<void>
} | null = null

export function walletConnectConfigured(): boolean {
  return Boolean((import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim())
}

/**
 * Open WalletConnect modal so the user can pick MetaMask / Trust / etc.
 * Returns an ethers signer on BSC for the deposit transfer.
 */
export async function connectWalletConnectForPay(): Promise<{
  address: string
  provider: BrowserProvider
  signer: JsonRpcSigner
  via: 'walletconnect' | 'injected'
}> {
  const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()

  // Prefer WalletConnect QR / deep-link wallet picker when configured.
  if (projectId) {
    try {
      const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
      if (!cachedWcProvider) {
        cachedWcProvider = await EthereumProvider.init({
          projectId,
          showQrModal: true,
          chains: [BSC_CHAIN_ID],
          optionalChains: [BSC_CHAIN_ID, 1],
          methods: ['eth_sendTransaction', 'eth_signTransaction', 'personal_sign', 'eth_signTypedData'],
          events: ['chainChanged', 'accountsChanged'],
          metadata: {
            name: 'Virtual FX Trades',
            description: 'VFXT deposit payment',
            url:
              typeof window !== 'undefined' ? window.location.origin : 'https://virtualfxtrades.com',
            icons: [
              `${typeof window !== 'undefined' ? window.location.origin : 'https://virtualfxtrades.com'}/favicon.svg`,
            ],
          },
        })
      }
      await cachedWcProvider.enable()
      const eth = cachedWcProvider as unknown as EvmRequestProvider
      await ensureBscNetwork(eth)
      const browser = new BrowserProvider(eth, BSC_CHAIN_ID)
      const signer = await browser.getSigner()
      const address = await signer.getAddress()
      return { address, provider: browser, signer, via: 'walletconnect' }
    } catch (err) {
      // Fall through to injected if WC cancelled / failed and MetaMask is present.
      if (typeof window !== 'undefined' && window.ethereum) {
        const eth = window.ethereum as EvmRequestProvider
        const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
        if (!accounts[0]) throw err instanceof Error ? err : new Error('WalletConnect failed')
        await ensureBscNetwork(eth)
        const browser = new BrowserProvider(eth, BSC_CHAIN_ID)
        const signer = await browser.getSigner()
        return {
          address: await signer.getAddress(),
          provider: browser,
          signer,
          via: 'injected',
        }
      }
      throw err instanceof Error ? err : new Error('WalletConnect failed')
    }
  }

  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error(
      'WalletConnect is not configured and no browser wallet was found. Set VITE_WALLETCONNECT_PROJECT_ID or install MetaMask.',
    )
  }
  const eth = window.ethereum as EvmRequestProvider
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts[0]) throw new Error('No account returned from wallet')
  await ensureBscNetwork(eth)
  const browser = new BrowserProvider(eth, BSC_CHAIN_ID)
  const signer = await browser.getSigner()
  return {
    address: await signer.getAddress(),
    provider: browser,
    signer,
    via: 'injected',
  }
}

export async function disconnectWalletConnectPay(): Promise<void> {
  try {
    await cachedWcProvider?.disconnect?.()
  } catch {
    /* ignore */
  }
  cachedWcProvider = null
}
