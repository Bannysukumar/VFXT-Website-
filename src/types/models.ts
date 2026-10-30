export type AdminRole =
  | 'super_admin'
  | 'finance_admin'
  | 'operations_admin'
  | 'support_admin'
  | 'readonly_admin'

export type UserStatus = 'active' | 'suspended' | 'pending_verification'

export type TransactionStatus =
  | 'pending'
  | 'approved'
  | 'processing'
  | 'completed'
  | 'rejected'
  | 'cancelled'
  | 'failed'

export type LedgerEntryType =
  | 'deposit_credit'
  | 'withdrawal_debit'
  | 'withdrawal_reserve'
  | 'withdrawal_release'
  | 'transfer_in'
  | 'transfer_out'
  | 'transfer'
  | 'adjustment'
  | 'fee'
  | 'referral_credit'
  | 'referral_bonus'
  | 'staking_reward'
  | 'stake'
  | 'roi'
  | 'level_commission'
  | 'direct_bonus'
  | 'rank_reward'
  | 'wallet_transfer'
  | 'locked_maturity'
  | 'locked_bonus'
  | string

export type LedgerDirection = 'credit' | 'debit'

export type CurrencyCode = 'USD' | 'VFXT'

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL?: string | null
  emailVerified: boolean
  status: UserStatus
  adminRole?: AdminRole | null
  referralCode: string
  referredBy?: string | null
  timezone?: string
  locale?: string
  preferences?: {
    theme?: 'system' | 'light' | 'dark'
    emailNotifications?: boolean
  }
  createdAt: string
  updatedAt: string
}

export interface WalletAccount {
  id: string
  userId: string
  currency: CurrencyCode
  kind?: string
  /** Integer smallest units — never trust client mutations */
  availableMinor: number
  reservedMinor: number
  scale: number
  updatedAt: string
}

export interface LedgerEntry {
  id: string
  userId: string
  walletId: string
  type: LedgerEntryType
  direction?: LedgerDirection
  amountMinor: number
  balanceAfterAvailableMinor: number
  balanceAfterReservedMinor: number
  currency: CurrencyCode
  status?: TransactionStatus | string
  description?: string
  idempotencyKey?: string
  referenceType?: string
  referenceId?: string
  metadata?: Record<string, string | number | boolean | null>
  createdAt: string
}

export interface DepositRequest {
  id: string
  userId: string
  amountMinor: number
  currency: CurrencyCode
  status: TransactionStatus
  provider?: string
  providerRef?: string
  idempotencyKey: string
  note?: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export interface WithdrawalRequest {
  id: string
  userId: string
  amountMinor: number
  currency: CurrencyCode
  status: TransactionStatus
  destination: string
  idempotencyKey: string
  note?: string
  /** On-chain BSC tx hash when the USDT send completed. */
  txHash?: string | null
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TokenConfig {
  name: string
  symbol: string
  decimals: number
  chainId?: number | null
  contractAddress?: string | null
  enabled: boolean
  initialSupplyConfigured: boolean
}

export interface FeatureFlags {
  stakingEnabled: boolean
  swapsEnabled: boolean
  gamingEnabled: boolean
  blockchainEnabled: boolean
  referralsEnabled: boolean
  depositsEnabled: boolean
  withdrawalsEnabled: boolean
}

export interface SupportTicket {
  id: string
  userId: string
  subject: string
  body: string
  category: 'account' | 'deposit' | 'withdrawal' | 'technical' | 'other'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority?: 'low' | 'normal' | 'high'
  assigneeId?: string | null
  createdAt: string
  updatedAt: string
}

export interface ReferralRecord {
  id: string
  referrerId: string
  refereeId: string
  status: 'pending' | 'qualified' | 'rewarded' | 'invalid'
  createdAt: string
}

export interface NotificationItem {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
  readAt?: string | null
  href?: string
}
