import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { AdminRole } from '../lib/permissions';
import {
  LockedPackageId,
  StakingPlanId,
  WalletKind,
} from '../config/plan';

export type ServerTimestamp = Timestamp | FieldValue;

export type UserStatus = 'active' | 'suspended' | 'closed';
export type KycStatus = 'none' | 'pending' | 'verified' | 'rejected';
export type BinarySide = 'left' | 'right';

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  /** E.164-ish mobile number collected at registration. */
  mobile: string | null;
  /** Optional BEP-20 wallet linked at signup or wallet-login. */
  walletAddress: string | null;
  timezone: string | null;
  locale: string | null;
  preferences: Record<string, unknown>;
  status: UserStatus;
  kycStatus: KycStatus;
  referralCode: string;
  referredBy: string | null;
  /** Binary tree parent (sponsor placement). */
  binaryParentId: string | null;
  binarySide: BinarySide | null;
  binaryLeftId: string | null;
  binaryRightId: string | null;
  /** Cumulative binary volume in USD cents. */
  leftVolumeMinor: number;
  rightVolumeMinor: number;
  currentRank: number;
  lastRankPaidAt: ServerTimestamp | null;
  rankCycleStart: ServerTimestamp | null;
  adminRole: AdminRole | null;
  role: 'user' | 'admin';
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
}

export type WalletCurrency = 'USD' | 'VFXT';

export interface WalletDoc {
  walletId: string;
  userId: string;
  kind: WalletKind;
  currency: WalletCurrency;
  /** Spendable balance in minor units (integer). */
  availableMinor: number;
  /** Reserved (e.g. pending withdrawal) in minor units (integer). */
  reservedMinor: number;
  decimals: number;
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
}

export type LedgerEntryType =
  | 'deposit_credit'
  | 'withdrawal_reserve'
  | 'withdrawal_release'
  | 'withdrawal_debit'
  | 'adjustment'
  | 'referral_bonus'
  | 'staking_reward'
  | 'transfer'
  | 'stake'
  | 'roi'
  | 'level_commission'
  | 'direct_bonus'
  | 'rank_reward'
  | 'wallet_transfer'
  | 'peer_transfer'
  | 'locked_maturity'
  | 'locked_bonus';

export type LedgerDirection = 'credit' | 'debit';

export interface LedgerEntry {
  entryId: string;
  userId: string;
  walletId: string;
  type: LedgerEntryType;
  direction: LedgerDirection;
  amountMinor: number;
  balanceAfterAvailableMinor: number;
  balanceAfterReservedMinor: number;
  currency: WalletCurrency;
  referenceType: string;
  referenceId: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: ServerTimestamp;
  createdBy: string;
}

export type DepositStatus =
  | 'pending'
  | 'awaiting_payment'
  | 'approved'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'expired';

export interface DepositRequest {
  depositId: string;
  userId: string;
  walletId: string;
  currency: WalletCurrency;
  amountMinor: number;
  status: DepositStatus;
  method: string;
  reference: string | null;
  note: string | null;
  reviewedBy: string | null;
  reviewedAt: ServerTimestamp | null;
  rejectionReason: string | null;
  /** On-chain payment fields (USDT BEP-20). */
  depositAddress?: string | null;
  expectedWei?: string | null;
  /** Unique dust tag so same-dollar deposits don't collide on one hot wallet. */
  paymentTag?: number | null;
  txHash?: string | null;
  chainId?: number | null;
  expiresAt?: ServerTimestamp | null;
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
}

export type WithdrawalStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'failed';

export interface WithdrawalRequest {
  withdrawalId: string;
  userId: string;
  walletId: string;
  currency: WalletCurrency;
  /** Gross amount debited from the user wallet (USD cents). */
  amountMinor: number;
  /** Fee kept by platform (USD cents). */
  commissionMinor?: number;
  /** Net USDT sent on-chain (USD cents). */
  netAmountMinor?: number;
  /** Fee rate applied (basis points). */
  commissionBps?: number;
  status: WithdrawalStatus;
  destination: string;
  method: string;
  reviewedBy: string | null;
  reviewedAt: ServerTimestamp | null;
  completedAt: ServerTimestamp | null;
  rejectionReason: string | null;
  txHash?: string | null;
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
}

export interface ReferralDoc {
  referralId: string;
  referrerId: string;
  refereeId: string;
  code: string;
  status: 'active' | 'revoked';
  binarySide: BinarySide | null;
  createdAt: ServerTimestamp;
}

export interface TokenConfig {
  symbol: string;
  name: string;
  decimals: number;
  chainId: number | null;
  contractAddress: string | null;
  blockchainEnabled: boolean;
  updatedAt: ServerTimestamp;
}

export interface NotificationDoc {
  notificationId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  readAt: ServerTimestamp | null;
  createdAt: ServerTimestamp;
}

export type SupportTicketStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface SupportTicket {
  ticketId: string;
  userId: string;
  subject: string;
  body: string;
  category: string;
  status: SupportTicketStatus;
  priority: 'low' | 'normal' | 'high';
  assigneeId: string | null;
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
}

export interface SupportMessage {
  messageId: string;
  ticketId: string;
  authorId: string;
  body: string;
  isStaff: boolean;
  createdAt: ServerTimestamp;
}

export interface AuditLogEntry {
  logId: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: ServerTimestamp;
}

/** Legacy Firestore staking config docs (optional). */
export interface StakingConfig {
  configId: string;
  name: string;
  apyBps: number;
  lockDays: number;
  minStakeMinor: number;
  currency: WalletCurrency;
  active: boolean;
  createdAt: ServerTimestamp;
}

export type StakingPositionStatus = 'active' | 'completed' | 'cancelled';

/**
 * Staking position.
 *
 * Daily yield:
 * - Credits 1%/day to daily_roi until days>=200 or totalPaid>=cap.
 * - Each credit is due exactly 24h after stake createdAt (and every +24h after).
 * - Cap = 2X principal (non-working) or 3X (working = ≥1 direct).
 *
 * Locked packages (300/500/700):
 * - On create: debit fund, credit staking (tracking).
 * - At maturity: credit principal*multiplier USD to withdrawal;
 *   credit bonus VFXT (principal_tokens * bonusPct/100) to vfxt wallet;
 *   debit staking tracking balance.
 */
export interface StakingPosition {
  positionId: string;
  userId: string;
  planId: StakingPlanId;
  /** For locked packages. */
  lockedPackageId: LockedPackageId | null;
  principalMinor: number;
  totalPaidMinor: number;
  daysPaid: number;
  status: StakingPositionStatus;
  workingAccount: boolean;
  capMinor: number;
  multiplier: number | null;
  bonusTokenPct: number | null;
  lockDays: number | null;
  maturesAt: ServerTimestamp | null;
  completedAt: ServerTimestamp | null;
  lastYieldAt: ServerTimestamp | null;
  createdAt: ServerTimestamp;
  updatedAt: ServerTimestamp;
}

export interface RankPayout {
  payoutId: string;
  userId: string;
  rank: number;
  rewardMinor: number;
  leftVolumeMinor: number;
  rightVolumeMinor: number;
  createdAt: ServerTimestamp;
}

export interface AdminDoc {
  uid: string;
  adminRole: AdminRole;
  createdAt: ServerTimestamp;
  createdBy: string;
  updatedAt: ServerTimestamp;
}

export type { WalletKind, StakingPlanId, LockedPackageId };
