import { callFunction } from '@/services/api'
import type { WalletKind } from '@/lib/plan'

export type StakingPlanId = 'daily_yield' | 'locked_300' | 'locked_500' | 'locked_700'

export interface StakingPosition {
  id: string
  planId: StakingPlanId
  principalMinor: number
  totalPaidMinor: number
  daysPaid: number
  status: 'active' | 'completed' | 'cancelled'
  workingAccount: boolean
  capMinor: number
  createdAt: string
  lastYieldAt?: string | null
  nextYieldAt?: string | null
  maturesAt?: string | null
}

export interface AffiliateMember {
  uid: string
  displayName: string | null
  email: string | null
  mobile: string | null
  referralCode: string | null
  createdAt: string | null
  level: number
}

export interface AffiliateDashboard {
  referralCode: string
  directCount: number
  unlockedLevels: number
  levelIncomeMinor: number
  directs: AffiliateMember[]
  levelStats: Array<{
    level: number
    rateBps: number
    unlocked: boolean
    earnedMinor: number
    memberCount?: number | null
  }>
}

export interface RankStatus {
  currentRank: number
  qualifiedRank?: number
  leftVolumeMinor: number
  rightVolumeMinor: number
  nextRank: number | null
  nextLeftNeedMinor: number
  nextRightNeedMinor: number
  lastRewardAt?: string | null
  salaryRank?: number | null
  salaryCyclesPaid?: number
  salaryMaxCycles?: number
  salaryCyclesRemaining?: number
  ranks?: Array<{
    rank: number
    leftMinor: number
    rightMinor: number
    rewardMinor: number
    cycleDays: number
    maxCycles: number
    enabled?: boolean
  }>
}

export async function getStakingPlans() {
  return callFunction<undefined, { plans: Array<Record<string, unknown>> }>('getStakingPlans')
}

export async function createStakingPosition(input: {
  planId: StakingPlanId
  amountMinor: number
  idempotencyKey: string
}) {
  return callFunction<typeof input, { positionId: string }>('createStakingPosition', input)
}

export async function getMyStakingPositions() {
  return callFunction<undefined, { positions: StakingPosition[] }>('getMyStakingPositions')
}

export async function getAffiliateDashboard() {
  return callFunction<undefined, AffiliateDashboard>('getAffiliateDashboard')
}

export async function getAffiliateLevelMembers(level: number, limit = 100) {
  return callFunction<
    { level: number; limit: number },
    {
      level: number
      unlocked: boolean
      count: number
      members: AffiliateMember[]
    }
  >('getAffiliateLevelMembers', { level, limit })
}

export async function applyReferralCode(code: string) {
  return callFunction<{ code: string }, { ok: true }>('applyReferralCode', { code })
}

export async function getRankStatus() {
  return callFunction<undefined, RankStatus>('getRankStatus')
}

export async function transferBetweenWallets(input: {
  fromKind: WalletKind
  toKind: WalletKind
  amountMinor: number
  idempotencyKey: string
}) {
  return callFunction<typeof input, { ok: true }>('transferBetweenWallets', input)
}

export async function transferToUser(input: {
  toUserId: string
  walletKind: 'vfxt' | 'withdrawal'
  amountMinor: number
  note?: string
  idempotencyKey: string
}) {
  return callFunction<
    typeof input,
    {
      ok: true
      toUserId: string
      toUid: string
      walletKind: string
      amountMinor: number
      currency: string
    }
  >('transferToUser', input)
}

export async function lookupUserId(userId: string) {
  return callFunction<
    { userId: string },
    { userId: string; displayName: string | null }
  >('lookupUserId', { userId })
}

export async function ensureWallets() {
  return callFunction<undefined, { created: string[] }>('ensureWallets')
}
