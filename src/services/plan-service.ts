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
  maturesAt?: string | null
}

export interface AffiliateDashboard {
  referralCode: string
  directCount: number
  unlockedLevels: number
  levelIncomeMinor: number
  directs: Array<{ uid: string; email?: string | null; createdAt?: string }>
  levelStats: Array<{ level: number; rateBps: number; unlocked: boolean; earnedMinor: number }>
}

export interface RankStatus {
  currentRank: number
  leftVolumeMinor: number
  rightVolumeMinor: number
  nextRank: number | null
  nextLeftNeedMinor: number
  nextRightNeedMinor: number
  lastRewardAt?: string | null
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

export async function ensureWallets() {
  return callFunction<undefined, { created: string[] }>('ensureWallets')
}
