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
  status?: string
  kycStatus?: string
  adminRole: AdminRole | null
}

export async function listUsers(startAfterUid?: string) {
  return callFunction<
    { limit: number; startAfterUid?: string },
    { users: AdminUserSummary[]; nextCursor: string | null }
  >('listUsers', startAfterUid ? { limit: 50, startAfterUid } : { limit: 50 })
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
  status?: 'active' | 'suspended' | 'closed'
  kycStatus?: 'none' | 'pending' | 'verified' | 'rejected'
  disabled?: boolean
  withdrawalAddress?: string | null
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
