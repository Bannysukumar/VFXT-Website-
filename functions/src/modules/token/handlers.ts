import { onCall } from 'firebase-functions/v2/https';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { requireAuth } from '../../lib/permissions';
import { TokenConfig } from '../../types/models';
import { isFeatureEnabled } from '../../config/features';

const DEFAULT_TOKEN_CONFIG: Omit<TokenConfig, 'updatedAt'> & {
  updatedAt: null;
} = {
  symbol: 'VFXT',
  name: 'VFXTToken',
  decimals: 18,
  chainId: 56,
  contractAddress: '0xB1F5170839CDaDE72109fA5C268dc043bF9bFbF4',
  blockchainEnabled: false,
  updatedAt: null,
};

export const getTokenConfig = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAuth(request);
    const db = getDb();
    const snap = await db.collection(Collections.token).doc('vfxt').get();

    const blockchainOn = isFeatureEnabled('blockchain');

    if (!snap.exists) {
      return {
        ...DEFAULT_TOKEN_CONFIG,
        blockchainEnabled: blockchainOn,
      };
    }

    const data = snap.data() as TokenConfig;
    return {
      symbol: data.symbol,
      name: data.name,
      decimals: data.decimals,
      chainId: data.chainId,
      contractAddress: data.contractAddress,
      // Server flag wins over stored doc until blockchain is verified.
      blockchainEnabled: blockchainOn && data.blockchainEnabled === true,
      updatedAt: data.updatedAt ?? null,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});
