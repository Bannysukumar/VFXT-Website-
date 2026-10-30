import { FeatureDisabledError } from '../../lib/errors';
import { FeatureFlags } from '../../config/features';
import { AppError } from '../../lib/errors';

/** Supported EVM chain IDs when blockchain is enabled. */
export const ALLOWED_CHAIN_IDS = [1, 11155111] as const; // mainnet, sepolia

export interface TransferReceiptVerification {
  chainId: number;
  txHash: string;
  expectedTo: string;
  expectedTokenAddress: string;
  expectedAmountMinor: string; // string to avoid float; wei/minor as decimal string
  expectedFrom?: string;
}

export interface BlockchainAdapter {
  validateChainId(chainId: number): void;
  verifyTransferReceipt(
    input: TransferReceiptVerification,
  ): Promise<{ verified: true; blockNumber: number }>;
}

/**
 * Stub adapter — throws FeatureDisabledError until configured.
 * No private keys ever live in this package.
 */
export class StubBlockchainAdapter implements BlockchainAdapter {
  validateChainId(chainId: number): void {
    if (!FeatureFlags.blockchain) {
      throw new FeatureDisabledError(
        'blockchain',
        'Blockchain features are disabled',
      );
    }
    if (!(ALLOWED_CHAIN_IDS as readonly number[]).includes(chainId)) {
      throw new AppError('invalid-argument', `Unsupported chainId ${chainId}`);
    }
  }

  async verifyTransferReceipt(
    input: TransferReceiptVerification,
  ): Promise<{ verified: true; blockNumber: number }> {
    this.validateChainId(input.chainId);
    // Intentionally unimplemented — wire a real RPC provider when enabling.
    throw new FeatureDisabledError(
      'blockchain',
      'verifyTransferReceipt is not configured',
    );
  }
}

let adapter: BlockchainAdapter = new StubBlockchainAdapter();

export function getBlockchainAdapter(): BlockchainAdapter {
  return adapter;
}

/** Test/DI hook only — never pass private-key-backed adapters in production code. */
export function setBlockchainAdapterForTests(
  next: BlockchainAdapter,
): void {
  adapter = next;
}
