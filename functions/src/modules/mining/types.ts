export type PayoutMode = 'admin_approved' | 'automatic';

export type MiningSessionStatus = 'active' | 'completed' | 'stopped';

export type ClaimStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'processing'
  | 'paid'
  | 'failed';

export interface MiningConfigDoc {
  enabled: boolean;
  /** Free (unpaid) mining rate — minor units per hour (18 decimals). */
  ratePerHourMinor: string;
  /** Free mining session length in seconds. */
  durationSeconds: number;
  minimumClaimMinor: string;
  maximumRewardMinor: string;
  allowStop: boolean;
  payoutMode: PayoutMode;
  /**
   * BSC address that receives USDT BEP-20 booster payments.
   * Admin-configured; never a private key.
   */
  boosterPaymentWallet?: string | null;
  updatedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

/** Admin-defined booster product in the catalog. */
export interface MiningBoosterDoc {
  boosterId: string;
  name: string;
  description: string;
  /** Extra VFXT/hour while the booster is active (18-dec minor string). */
  bonusRatePerHourMinor: string;
  /** How long the boost lasts after successful payment (seconds). */
  durationSeconds: number;
  /** USDT amount in wei (18 decimals), decimal string of integer. */
  priceUsdtWei: string;
  /** Display helper, e.g. "5.00". */
  priceUsdt: string;
  paymentToken: 'USDT_BEP20';
  enabled: boolean;
  sortOrder: number;
  createdAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  updatedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

export type BoosterPurchaseStatus =
  | 'awaiting_payment'
  | 'activated'
  | 'expired_unpaid'
  | 'cancelled';

export interface MiningBoosterPurchaseDoc {
  purchaseId: string;
  userId: string;
  walletAddress: string;
  boosterId: string;
  boosterName: string;
  bonusRatePerHourMinor: string;
  boostDurationSeconds: number;
  /** Exact USDT wei the user must send (unique per purchase). */
  expectedUsdtWei: string;
  priceUsdt: string;
  paymentToken: 'USDT_BEP20';
  paymentWallet: string;
  status: BoosterPurchaseStatus;
  transactionHash?: string | null;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  expiresAt: FirebaseFirestore.Timestamp;
  paidAt?: FirebaseFirestore.Timestamp | null;
  activatedAt?: FirebaseFirestore.Timestamp | null;
}

export interface MiningUserBoosterDoc {
  userBoosterId: string;
  userId: string;
  boosterId: string;
  purchaseId: string;
  boosterName: string;
  bonusRatePerHourMinor: string;
  status: 'active' | 'expired';
  activatedAt: FirebaseFirestore.Timestamp;
  expiresAt: FirebaseFirestore.Timestamp;
}

export interface MiningSessionDoc {
  sessionId: string;
  userId: string;
  walletAddress: string;
  startTime: FirebaseFirestore.Timestamp;
  endTime: FirebaseFirestore.Timestamp;
  rateSnapshotMinor: string;
  status: MiningSessionStatus;
  rewardAmountMinor: string;
  completedAt?: FirebaseFirestore.Timestamp | null;
}

export interface RewardLedgerDoc {
  ledgerId: string;
  userId: string;
  amountMinor: string;
  type: 'mining_credit' | 'claim_debit' | 'adjustment';
  sessionId?: string | null;
  claimId?: string | null;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}

export interface ClaimRequestDoc {
  claimId: string;
  userId: string;
  amountMinor: string;
  destinationAddress: string;
  network: string;
  status: ClaimStatus;
  transactionHash?: string | null;
  rejectReason?: string | null;
  createdAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  processedAt?: FirebaseFirestore.Timestamp | null;
}

export interface MiningBalanceDoc {
  userId: string;
  availableMinor: string;
  lifetimeMinor: string;
  claimedMinor: string;
  updatedAt: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
}
