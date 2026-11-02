import { Contract } from 'ethers'
import { connectEvmWallet, shortenError, txUrl } from '@/lib/evm-wallet'
import {
  connectWalletConnectForPay,
  walletConnectConfigured,
} from '@/lib/walletconnect-pay'

const ERC20_TRANSFER_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const

export type DepositSendInput = {
  tokenAddress: string
  depositAddress: string
  amountWei: string
  symbol: string
}

export type DepositSendResult = {
  txHash: string
  explorerUrl: string
  from: string
  via: 'walletconnect' | 'injected'
}

/**
 * Connect a wallet (WalletConnect modal preferred) and transfer the exact ERC-20 amount on BSC.
 */
export async function sendDepositToken(
  input: DepositSendInput,
  opts?: { preferWalletConnect?: boolean },
): Promise<DepositSendResult> {
  const preferWc = opts?.preferWalletConnect !== false
  const useWc = preferWc && (walletConnectConfigured() || typeof window.ethereum === 'undefined')

  const connected = useWc
    ? await connectWalletConnectForPay()
    : await connectEvmWallet().then((c) => ({ ...c, via: 'injected' as const }))

  const token = new Contract(input.tokenAddress, ERC20_TRANSFER_ABI, connected.signer)
  const amount = BigInt(input.amountWei)
  if (amount <= 0n) throw new Error('Invalid deposit amount')

  const balance = (await token.balanceOf(connected.address)) as bigint
  if (balance < amount) {
    throw new Error(
      `Insufficient ${input.symbol} balance. Need the exact amount shown on this page.`,
    )
  }

  try {
    const tx = await token.transfer(input.depositAddress, amount)
    const receipt = await tx.wait()
    const txHash = String(receipt?.hash || tx.hash)
    return {
      txHash,
      explorerUrl: txUrl(txHash),
      from: connected.address,
      via: connected.via,
    }
  } catch (err) {
    throw new Error(shortenError(err))
  }
}
