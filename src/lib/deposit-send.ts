import { Contract } from 'ethers'
import { connectEvmWallet, shortenError, txUrl } from '@/lib/evm-wallet'

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
}

/** Connect injected wallet on BSC and transfer the exact ERC-20 amount. */
export async function sendDepositToken(input: DepositSendInput): Promise<DepositSendResult> {
  const { signer, address } = await connectEvmWallet()
  const token = new Contract(input.tokenAddress, ERC20_TRANSFER_ABI, signer)
  const amount = BigInt(input.amountWei)
  if (amount <= 0n) throw new Error('Invalid deposit amount')

  const balance = (await token.balanceOf(address)) as bigint
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
      from: address,
    }
  } catch (err) {
    throw new Error(shortenError(err))
  }
}
