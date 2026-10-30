import { callFunction } from '@/services/api'

export async function getCryptoWalletInfo() {
  return callFunction<
    undefined,
    {
      configured: boolean
      depositAddress: string | null
      network: string
      token: string
      tokenAddress: string
      chainId: number
    }
  >('getCryptoWalletInfo')
}

export async function getAdminCryptoWalletInfo() {
  return callFunction<
    undefined,
    {
      configured: boolean
      address: string | null
      autoWithdraw: boolean
      balanceUsdt: string | null
      network: string
      token: string
      tokenAddress: string
      privateKeySet: boolean
    }
  >('getAdminCryptoWalletInfo')
}

export async function setCryptoHotWallet(input: {
  privateKey?: string
  /** Preferred: base64 of hex key so wallet extensions don't strip raw hex. */
  privateKeyB64?: string
  rpcUrl?: string
  autoWithdraw?: boolean
}) {
  return callFunction<typeof input, { ok: true; address: string }>('setCryptoHotWallet', input)
}

export async function checkDepositPayment(depositId: string, txHash?: string) {
  return callFunction<
    { depositId: string; txHash?: string },
    {
      status: string
      txHash: string | null
      depositId: string
      depositAddress?: string
    }
  >('checkDepositPayment', { depositId, ...(txHash ? { txHash } : {}) })
}
