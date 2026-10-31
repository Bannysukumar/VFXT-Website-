import { callFunction } from '@/services/api'
import type { AdminRole } from '@/types/models'

export async function bootstrapFirstAdmin(bootstrapSecret: string) {
  return callFunction<{ secret: string }, { ok: true }>('bootstrapFirstAdmin', {
    secret: bootstrapSecret,
  })
}

export async function setAdminRole(uid: string, adminRole: AdminRole | null) {
  return callFunction<{ uid: string; adminRole: AdminRole | null }, { ok: true }>('setAdminRole', {
    uid,
    adminRole,
  })
}

export async function approveDeposit(depositId: string, idempotencyKey: string) {
  return callFunction<{ depositId: string; idempotencyKey: string }, { ok: true }>(
    'approveDeposit',
    { depositId, idempotencyKey },
  )
}

export async function rejectDeposit(depositId: string, reason: string) {
  return callFunction<{ depositId: string; reason: string }, { ok: true }>('rejectDeposit', {
    depositId,
    reason,
  })
}

export async function approveWithdrawal(withdrawalId: string) {
  return callFunction<{ withdrawalId: string }, { ok: true }>('approveWithdrawal', {
    withdrawalId,
  })
}

export async function completeWithdrawal(withdrawalId: string, idempotencyKey: string) {
  return callFunction<{ withdrawalId: string; idempotencyKey: string }, { ok: true }>(
    'completeWithdrawal',
    { withdrawalId, idempotencyKey },
  )
}

export async function rejectWithdrawal(withdrawalId: string, reason: string) {
  return callFunction<{ withdrawalId: string; reason: string }, { ok: true }>('rejectWithdrawal', {
    withdrawalId,
    reason,
  })
}

export async function getPlatformStats() {
  return callFunction<
    undefined,
    {
      userCount: number
      pendingDeposits: number
      pendingWithdrawals: number
      openTickets: number
    }
  >('getPlatformStats')
}

export interface AdminUserSummary {
  uid: string
  email: string | null
  displayName: string | null
  mobile?: string | null
  referralCode?: string | null
  referredBy?: string | null
  referredByName?: string | null
  referredByCode?: string | null
  walletAddress?: string | null
  status?: string
  kycStatus?: string
  adminRole: AdminRole | null
  createdAt?: string | null
}

export type ListUsersFilters = {
  startAfterUid?: string
  status?: string
  kycStatus?: string
  limit?: number
}

export async function listUsers(filters: ListUsersFilters = {}) {
  const payload: Record<string, unknown> = {
    limit: filters.limit ?? 100,
  }
  if (filters.startAfterUid) payload.startAfterUid = filters.startAfterUid
  if (filters.status) payload.status = filters.status
  if (filters.kycStatus) payload.kycStatus = filters.kycStatus
  return callFunction<
    Record<string, unknown>,
    { users: AdminUserSummary[]; nextCursor: string | null }
  >('listUsers', payload)
}

export async function updateTicketStatus(
  ticketId: string,
  status: 'open' | 'in_progress' | 'resolved' | 'closed',
) {
  return callFunction<{ ticketId: string; status: string }, { ticketId: string }>(
    'updateTicketStatus',
    { ticketId, status },
  )
}

export interface AdminWalletRow {
  walletId: string
  kind: string
  currency: string
  availableMinor: number
  reservedMinor: number
}

export interface AdminUserProfileDetail {
  uid: string
  email?: string | null
  displayName?: string | null
  status?: string
  kycStatus?: string
  adminRole?: AdminRole | null
  withdrawalAddress?: string | null
  [key: string]: unknown
}

export async function getAdminUserDetail(uid: string) {
  return callFunction<
    { uid: string },
    {
      profile: AdminUserProfileDetail
      auth: { email?: string; disabled?: boolean; emailVerified?: boolean }
      wallets: AdminWalletRow[]
    }
  >('getAdminUserDetail', { uid })
}

export type AdminUpdateUserInput = {
  uid: string
  displayName?: string
  mobile?: string
  status?: 'active' | 'suspended' | 'closed'
  kycStatus?: 'none' | 'pending' | 'verified' | 'rejected'
  disabled?: boolean
  withdrawalAddress?: string | null
  walletAddress?: string | null
}

export async function adminUpdateUser(input: AdminUpdateUserInput) {
  return callFunction<AdminUpdateUserInput, { ok: true }>('adminUpdateUser', input)
}

export async function adminAdjustWallet(input: {
  uid: string
  walletKind: string
  amountMinor: number
  reason: string
}) {
  return callFunction<
    { uid: string; walletKind: string; amountMinor: number; reason: string },
    { ok: true; walletId: string }
  >('adminAdjustWallet', input)
}

export async function impersonateUser(uid: string) {
  return callFunction<
    { uid: string },
    { token: string; uid: string; email: string | null }
  >('impersonateUser', { uid })
}

export type PlatformSettingsPatch = Record<string, unknown>

export async function getAdminPlatformSettings() {
  return callFunction<undefined, Record<string, unknown>>('getAdminPlatformSettings')
}

export async function updatePlatformSettings(patch: PlatformSettingsPatch) {
  return callFunction<PlatformSettingsPatch, Record<string, unknown>>('updatePlatformSettings', patch)
}

export interface CryptoHotWalletPoolEntry {
  id: string
  label: string
  address: string
  rpcUrl?: string
  enabled: boolean
}

export async function listCryptoHotWallets() {
  return callFunction<
    undefined,
    {
      configured: boolean
      address: string | null
      network: string
      token: string
      tokenAddress: string
      pool: CryptoHotWalletPoolEntry[]
    }
  >('listCryptoHotWallets')
}

export async function addCryptoHotWallet(input: {
  privateKeyB64?: string
  privateKey?: string
  label?: string
  rpcUrl?: string
}) {
  return callFunction<
    typeof input,
    { ok: true; id: string; address: string }
  >('addCryptoHotWallet', input)
}

export async function updateCryptoHotWallet(input: {
  id: string
  enabled?: boolean
  label?: string
  rpcUrl?: string
}) {
  return callFunction<typeof input, { ok: true }>('updateCryptoHotWallet', input)
}

export async function removeCryptoHotWallet(id: string) {
  return callFunction<{ id: string }, { ok: true }>('removeCryptoHotWallet', { id })
}

export type AdminIncomeType =
  | 'roi'
  | 'level_commission'
  | 'direct_bonus'
  | 'referral_bonus'
  | 'rank_reward'
  | 'staking_reward'
  | 'locked_maturity'
  | 'locked_bonus'
  | 'deposit_credit'
  | 'peer_transfer'

export async function adminListAutoDeposits(limit = 500) {
  return callFunction<
    { limit: number },
    { rows: Array<Record<string, unknown>>; count: number }
  >('adminListAutoDeposits', { limit })
}

export async function adminListAutoWithdrawals(limit = 500) {
  return callFunction<
    { limit: number },
    { rows: Array<Record<string, unknown>>; count: number }
  >('adminListAutoWithdrawals', { limit })
}

export async function adminListIncomeByType(type: AdminIncomeType, limit = 500) {
  return callFunction<
    { type: AdminIncomeType; limit: number },
    { rows: Array<Record<string, unknown>>; count: number; totalMinor: number; type: string }
  >('adminListIncomeByType', { type, limit })
}

export async function adminListPeerTransfers(limit = 500) {
  return callFunction<
    { limit: number },
    { rows: Array<Record<string, unknown>>; count: number }
  >('adminListPeerTransfers', { limit })
}

/** VFXT Wallet Android mining admin */
export async function adminMiningDashboardStats() {
  return callFunction<
    undefined,
    {
      config: {
        enabled: boolean
        ratePerHour: string
        durationSeconds: number
        minimumClaim: string
        maximumReward: string
        allowStop: boolean
        payoutMode: 'admin_approved' | 'automatic'
        boosterPaymentWallet: string | null
      }
      stats: {
        activeSessions: number
        pendingClaims: number
        miningUsers: number
        totalLifetime: string
        totalAvailable: string
        totalClaimed: string
        totalPaidOut: string
        activeBoosters?: number
        activatedBoosterPurchases?: number
        boosterRevenueUsdt?: string
      }
    }
  >('adminMiningDashboardStats')
}

export async function adminGetMiningConfig() {
  return callFunction<
    undefined,
    {
      enabled: boolean
      ratePerHourMinor: string
      durationSeconds: number
      minimumClaimMinor: string
      maximumRewardMinor: string
      allowStop: boolean
      payoutMode: 'admin_approved' | 'automatic'
    }
  >('adminGetMiningConfig')
}

export async function adminUpdateMiningConfig(input: {
  enabled?: boolean
  ratePerHour?: string
  durationSeconds?: number
  minimumClaim?: string
  maximumReward?: string
  allowStop?: boolean
  payoutMode?: 'admin_approved' | 'automatic'
  boosterPaymentWallet?: string | null
}) {
  return callFunction<typeof input, Record<string, unknown>>('adminUpdateMiningConfig', input)
}

export async function adminListMiningClaims(input?: { status?: string; limit?: number }) {
  return callFunction<
    { status?: string; limit?: number },
    {
      items: Array<{
        claimId: string
        userId: string
        amount: string
        destinationAddress: string
        network: string
        status: string
        transactionHash: string | null
        rejectReason: string | null
        createdAtMillis: number | null
      }>
    }
  >('adminListMiningClaims', input ?? {})
}

export async function adminUpdateClaim(input: {
  claimId: string
  status: 'approved' | 'rejected' | 'paid' | 'failed'
  reason?: string
  transactionHash?: string
}) {
  return callFunction<typeof input, { claimId: string; status: string }>('adminUpdateClaim', input)
}

export async function adminListMiningBoosters(includeDisabled = false) {
  return callFunction<
    { includeDisabled?: boolean },
    {
      items: Array<{
        boosterId: string
        name: string
        description: string
        bonusRatePerHour: string
        durationSeconds: number
        priceUsdt: string
        paymentToken: string
        enabled: boolean
        sortOrder: number
      }>
    }
  >('listMiningBoosters', { includeDisabled })
}

export async function adminUpsertMiningBooster(input: {
  boosterId?: string
  name: string
  description?: string
  bonusRatePerHour: string
  durationSeconds: number
  priceUsdt: string
  enabled?: boolean
  sortOrder?: number
}) {
  return callFunction<typeof input, Record<string, unknown>>('adminUpsertMiningBooster', input)
}

export async function adminDeleteMiningBooster(boosterId: string) {
  return callFunction<{ boosterId: string }, { ok: true }>('adminDeleteMiningBooster', {
    boosterId,
  })
}

export async function adminSetBoosterPaymentWallet(address: string) {
  return callFunction<{ address: string }, { boosterPaymentWallet: string }>(
    'adminSetBoosterPaymentWallet',
    { address },
  )
}

export async function adminListBoosterHistory(input?: { status?: string; limit?: number }) {
  return callFunction<
    { status?: string; limit?: number },
    {
      items: Array<{
        purchaseId: string
        userId: string
        walletAddress: string
        boosterId: string
        boosterName: string
        bonusRatePerHour: string
        priceUsdt: string
        paymentWallet: string
        status: string
        transactionHash: string | null
        createdAtMillis: number | null
        activatedAtMillis: number | null
      }>
    }
  >('adminListBoosterHistory', input ?? {})
}

export async function adminListActiveUserBoosters() {
  return callFunction<
    undefined,
    {
      items: Array<{
        userBoosterId: string
        userId: string
        boosterId: string
        boosterName: string
        bonusRatePerHour: string
        purchaseId: string
        activatedAtMillis: number
        expiresAtMillis: number
        status: string
      }>
    }
  >('adminListActiveUserBoosters')
}

export async function adminGetBoosterStats() {
  return callFunction<
    undefined,
    {
      catalogCount: number
      enabledCatalogCount: number
      activeBoosters: number
      totalPurchases: number
      activatedPurchases: number
      awaitingPayment: number
      totalRevenueUsdt: string
    }
  >('adminGetBoosterStats')
}
