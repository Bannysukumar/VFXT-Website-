import { callFunction } from '@/services/api'
import { getFirebaseAuth, isFirebaseReady } from '@/lib/firebase'
import { signInWithCustomToken } from 'firebase/auth'
import { env } from '@/lib/env'

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  enable?: () => Promise<string[]>
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

const SIGNUP_SESSION_KEY = 'vfxt_wallet_signup'

export type WalletSignupSession = {
  address: string
  signupToken: string
  /** Optional sponsor code carried from /auth/register into wallet-register. */
  referralCode?: string
}

async function getInjectedProvider(): Promise<EthereumProvider> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet found. Install MetaMask, Trust, or open in a Web3 browser.')
  }
  return window.ethereum
}

async function connectInjected(): Promise<string> {
  const eth = await getInjectedProvider()
  const accounts = (await eth.request({ method: 'eth_requestAccounts' })) as string[]
  const address = accounts[0]
  if (!address) throw new Error('No account returned from wallet')
  return address
}

/**
 * WalletConnect v2 via EthereumProvider when project id is configured.
 * Falls back to injected browser wallets.
 */
async function connectWalletConnect(): Promise<{ address: string; provider: EthereumProvider }> {
  const projectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim()
  if (!projectId) {
    const address = await connectInjected()
    return { address, provider: await getInjectedProvider() }
  }

  try {
    const { EthereumProvider } = await import('@walletconnect/ethereum-provider')
    const provider = await EthereumProvider.init({
      projectId,
      showQrModal: true,
      chains: [56],
      optionalChains: [1, 56],
      methods: ['eth_sendTransaction', 'personal_sign'],
      events: ['chainChanged', 'accountsChanged'],
      metadata: {
        name: 'Virtual FX Trades',
        description: 'VFXT platform login',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://virtualfxtrades.com',
        icons: [`${typeof window !== 'undefined' ? window.location.origin : ''}/favicon.svg`],
      },
    })
    await provider.enable()
    const accounts = provider.accounts
    const address = accounts[0]
    if (!address) throw new Error('No account from WalletConnect')
    return {
      address,
      provider: {
        request: (args) => provider.request(args) as Promise<unknown>,
      },
    }
  } catch (err) {
    if (window.ethereum) {
      const address = await connectInjected()
      return { address, provider: await getInjectedProvider() }
    }
    throw err instanceof Error ? err : new Error('WalletConnect failed')
  }
}

export type WalletAuthResult =
  | {
      kind: 'logged_in'
      needsProfile: boolean
      isNewUser: boolean
      address: string
    }
  | {
      kind: 'needs_signup'
      address: string
      signupToken: string
    }

export function saveWalletSignupSession(session: WalletSignupSession) {
  sessionStorage.setItem(SIGNUP_SESSION_KEY, JSON.stringify(session))
}

export function readWalletSignupSession(): WalletSignupSession | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as WalletSignupSession
    if (!parsed.address || !parsed.signupToken) return null
    return parsed
  } catch {
    return null
  }
}

export function clearWalletSignupSession() {
  sessionStorage.removeItem(SIGNUP_SESSION_KEY)
}

export async function loginWithWallet(
  mode: 'injected' | 'walletconnect' = 'injected',
): Promise<WalletAuthResult> {
  if (!isFirebaseReady()) {
    throw new Error('Firebase is not configured')
  }

  const { address, provider } =
    mode === 'walletconnect'
      ? await connectWalletConnect()
      : { address: await connectInjected(), provider: await getInjectedProvider() }

  const challenge = await callFunction<
    { address: string },
    { nonce: string; message: string; address: string }
  >('getWalletLoginNonce', { address })

  const signature = (await provider.request({
    method: 'personal_sign',
    params: [challenge.message, address],
  })) as string

  const result = await callFunction<
    { address: string; signature: string },
    {
      customToken: string | null
      uid: string | null
      address: string
      isNewUser: boolean
      needsProfile: boolean
      needsSignup: boolean
      signupToken: string | null
    }
  >('verifyWalletLogin', { address, signature })

  if (result.needsSignup && result.signupToken) {
    const session: WalletSignupSession = {
      address: result.address,
      signupToken: result.signupToken,
    }
    saveWalletSignupSession(session)
    return { kind: 'needs_signup', ...session }
  }

  if (!result.customToken) {
    throw new Error('Wallet login failed — no session returned')
  }

  await signInWithCustomToken(getFirebaseAuth(), result.customToken)
  return {
    kind: 'logged_in',
    needsProfile: result.needsProfile,
    isNewUser: result.isNewUser,
    address: result.address,
  }
}

export async function completeWalletSignup(input: {
  signupToken: string
  address: string
  referralCode: string
  email?: string
  password?: string
  displayName?: string
  mobile?: string
}) {
  if (!isFirebaseReady()) {
    throw new Error('Firebase is not configured')
  }
  if (!input.referralCode?.trim()) {
    throw new Error('Referral code is required')
  }
  const payload = {
    signupToken: input.signupToken,
    address: input.address,
    referralCode: input.referralCode.trim(),
    ...(input.email?.trim() ? { email: input.email.trim() } : {}),
    ...(input.password ? { password: input.password } : {}),
    ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
    ...(input.mobile?.trim() ? { mobile: input.mobile.trim() } : {}),
  }
  const result = await callFunction<
    typeof payload,
    { customToken: string; uid: string; address: string; ok: true }
  >('completeWalletSignup', payload)
  await signInWithCustomToken(getFirebaseAuth(), result.customToken)
  clearWalletSignupSession()
  return result
}

export function walletConnectConfigured(): boolean {
  return Boolean((import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined)?.trim())
}

void env
