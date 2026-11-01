import { BrowserProvider, JsonRpcSigner, getAddress, isAddress } from 'ethers'

const BSC_CHAIN_ID = 56
const BSC_CHAIN_HEX = '0x38'

type EvmRequestProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
}

export function getInjectedEthereum(): EvmRequestProvider {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet found. Install MetaMask or open this page in a Web3 browser.')
  }
  return window.ethereum as EvmRequestProvider
}

export async function connectEvmWallet(): Promise<{ address: string; provider: BrowserProvider; signer: JsonRpcSigner }> {
  const eth = getInjectedEthereum()
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
  const raw = accounts[0]
  if (!raw) throw new Error('No account returned from wallet')
  await ensureBscNetwork(eth)
  const provider = new BrowserProvider(eth, BSC_CHAIN_ID)
  const signer = await provider.getSigner()
  const address = getAddress(await signer.getAddress())
  return { address, provider, signer }
}

export async function ensureBscNetwork(eth: EvmRequestProvider = getInjectedEthereum()): Promise<void> {
  const current = (await eth.request({ method: 'eth_chainId' })) as string
  if (Number.parseInt(current, 16) === BSC_CHAIN_ID) return

  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BSC_CHAIN_HEX }],
    })
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? Number((err as { code: number }).code) : 0
    // 4902 = chain not added
    if (code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: BSC_CHAIN_HEX,
            chainName: 'BNB Smart Chain',
            nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
            rpcUrls: ['https://bsc-dataseed.binance.org'],
            blockExplorerUrls: ['https://bscscan.com'],
          },
        ],
      })
      return
    }
    throw err instanceof Error ? err : new Error('Switch to BNB Smart Chain to continue')
  }
}

export function normalizeAddress(value: string): string {
  const trimmed = value.trim()
  if (!isAddress(trimmed)) throw new Error('Invalid address')
  return getAddress(trimmed)
}

export function txUrl(hash: string): string {
  return `https://bscscan.com/tx/${hash}`
}

export function shortenError(err: unknown): string {
  if (!err) return 'Transaction failed'
  if (typeof err === 'string') return err
  const anyErr = err as {
    shortMessage?: string
    reason?: string
    message?: string
    info?: { error?: { message?: string } }
    data?: { message?: string }
  }
  const raw =
    anyErr.shortMessage ||
    anyErr.reason ||
    anyErr.info?.error?.message ||
    anyErr.data?.message ||
    anyErr.message ||
    'Transaction failed'
  return raw
    .replace(/^execution reverted:\s*/i, '')
    .replace(/\s*\(action=.*?\)\.?$/i, '')
    .trim()
}
