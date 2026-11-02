import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import type { LedgerEntry, WalletAccount } from '@/types/models'
import { callFunction } from '@/services/api'

function toIso(value: Timestamp | string | undefined): string {
  if (!value) return new Date(0).toISOString()
  if (typeof value === 'string') return value
  return value.toDate().toISOString()
}

export async function fetchUserWallets(userId: string): Promise<WalletAccount[]> {
  if (!isFirebaseReady()) return []
  const q = query(collection(getDb(), 'wallets'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      userId: data.userId as string,
      currency: data.currency,
      kind: data.kind as string | undefined,
      availableMinor: Number(data.availableMinor ?? 0),
      reservedMinor: Number(data.reservedMinor ?? 0),
      scale: Number(data.decimals ?? data.scale ?? 2),
      updatedAt: toIso(data.updatedAt),
    } satisfies WalletAccount
  })
}

export function walletDocId(userId: string, kind: string): string {
  return `${userId}_${kind}`
}

export async function fetchUserLedger(
  userId: string,
  pageSize = 50,
  options?: { walletId?: string },
): Promise<LedgerEntry[]> {
  if (!isFirebaseReady()) return []
  const constraints = [
    where('userId', '==', userId),
    ...(options?.walletId ? [where('walletId', '==', options.walletId)] : []),
    orderBy('createdAt', 'desc'),
    limit(pageSize),
  ]
  const q = query(collection(getDb(), 'ledger'), ...constraints)
  const snap = await getDocs(q)
  return snap.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      userId: data.userId,
      walletId: data.walletId,
      type: data.type,
      direction: data.direction,
      amountMinor: Number(data.amountMinor ?? 0),
      balanceAfterAvailableMinor: Number(data.balanceAfterAvailableMinor ?? 0),
      balanceAfterReservedMinor: Number(data.balanceAfterReservedMinor ?? 0),
      currency: data.currency,
      status: data.status ?? 'completed',
      description: data.description,
      idempotencyKey: data.idempotencyKey,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      metadata: data.metadata,
      createdAt: toIso(data.createdAt),
    } satisfies LedgerEntry
  })
}

export interface CreateDepositResult {
  depositId: string
  status: string
  method: string
  depositAddress: string | null
  amountUsdt: string
  amountMinor: number
  network: string | null
  token: string | null
  tokenAddress: string | null
  qrPayload: string | null
  chainId: number | null
  expectedWei?: string | null
  paymentTag?: number | null
  /** ISO timestamp when awaiting payment expires (server). */
  expiresAt?: string | null
  expiresAtMs?: number | null
  ttlMs?: number | null
}

export type DepositPayMethod = 'usdt_bep20' | 'vfxt_bep20'

export async function requestDeposit(input: {
  amountMinor: number
  currency?: 'USD' | 'VFXT'
  idempotencyKey: string
  note?: string
  method?: DepositPayMethod | string
}) {
  const method = input.method ?? 'usdt_bep20'
  const currency = method === 'vfxt_bep20' ? 'VFXT' : 'USD'
  return callFunction<
    {
      amountMinor: number
      currency: 'USD' | 'VFXT'
      idempotencyKey: string
      note?: string
      method: string
    },
    CreateDepositResult
  >('createDepositRequest', {
    amountMinor: input.amountMinor,
    currency: input.currency ?? currency,
    idempotencyKey: input.idempotencyKey,
    note: input.note,
    method,
  })
}

export async function requestWithdrawal(input: {
  amountMinor: number
  currency?: 'USD' | 'VFXT'
  destination: string
  idempotencyKey: string
  note?: string
  method?: string
}) {
  return callFunction<
    {
      amountMinor: number
      currency: 'USD' | 'VFXT'
      destination: string
      idempotencyKey: string
      note?: string
      method: string
    },
    { withdrawalId: string; txHash: string | null; status: string }
  >('createWithdrawalRequest', {
    amountMinor: input.amountMinor,
    currency: input.currency ?? 'VFXT',
    destination: input.destination,
    idempotencyKey: input.idempotencyKey,
    note: input.note,
    method: input.method ?? 'usdt_bep20',
  })
}
