import {
  WalletCurrency,
  LedgerEntryType,
  LedgerDirection,
} from '../../types/models';
import {
  WALLET_CURRENCY,
  WALLET_DECIMALS,
  WALLET_KINDS,
  WalletKind,
} from '../../config/plan';

export interface AppendLedgerParams {
  userId: string;
  walletId: string;
  type: LedgerEntryType;
  direction: LedgerDirection;
  amountMinor: number;
  currency: WalletCurrency;
  referenceType: string;
  referenceId: string;
  description: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
  /** Mutate availableMinor by this delta (signed). */
  availableDelta: number;
  /** Mutate reservedMinor by this delta (signed). */
  reservedDelta: number;
}

export interface WalletKindDef {
  kind: WalletKind;
  currency: WalletCurrency;
  decimals: number;
}

/** Seven-wallet multi-wallet system. walletId = `${uid}_${kind}`. */
export const DEFAULT_WALLETS: ReadonlyArray<WalletKindDef> =
  WALLET_KINDS.map((kind) => ({
    kind,
    currency: WALLET_CURRENCY[kind],
    decimals: WALLET_DECIMALS[kind],
  }));

export function walletDocId(userId: string, kind: WalletKind): string {
  return `${userId}_${kind}`;
}

/** @deprecated Prefer walletDocId(userId, kind). Kept for migration reads. */
export function legacyWalletDocId(
  userId: string,
  currency: WalletCurrency,
): string {
  return `${userId}_${currency}`;
}
