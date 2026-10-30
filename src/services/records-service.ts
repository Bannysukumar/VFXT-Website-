import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryConstraint,
} from 'firebase/firestore'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import type {
  CurrencyCode,
  DepositRequest,
  SupportTicket,
  TransactionStatus,
  WithdrawalRequest,
} from '@/types/models'

/** Accepts Firestore Timestamps, callable-serialised timestamps, ISO strings, or nothing. */
export function toIsoDate(value: unknown): string {
  if (!value) return new Date(0).toISOString()
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    const v = value as { toDate?: () => Date; seconds?: number; _seconds?: number }
    if (typeof v.toDate === 'function') return v.toDate().toISOString()
    const seconds = v.seconds ?? v._seconds
    if (typeof seconds === 'number') return new Date(seconds * 1000).toISOString()
  }
  return new Date(0).toISOString()
}

async function runQuery<T>(
  path: string,
  constraints: QueryConstraint[],
  map: (id: string, data: DocumentData) => T,
): Promise<T[]> {
  if (!isFirebaseReady()) return []
  const snap = await getDocs(query(collection(getDb(), path), ...constraints))
  return snap.docs.map((d) => map(d.id, d.data()))
}

const mapDeposit = (id: string, data: DocumentData): DepositRequest => ({
  id,
  userId: data.userId,
  amountMinor: Number(data.amountMinor ?? 0),
  currency: (data.currency ?? 'USD') as CurrencyCode,
  status: data.status as TransactionStatus,
  provider: data.provider ?? data.method,
  providerRef: data.providerRef,
  idempotencyKey: data.idempotencyKey ?? '',
  note: data.note,
  reviewedBy: data.reviewedBy,
  reviewedAt: data.reviewedAt ? toIsoDate(data.reviewedAt) : undefined,
  createdAt: toIsoDate(data.createdAt),
  updatedAt: toIsoDate(data.updatedAt),
})

const mapWithdrawal = (id: string, data: DocumentData): WithdrawalRequest => ({
  id,
  userId: data.userId,
  amountMinor: Number(data.amountMinor ?? 0),
  currency: (data.currency ?? 'USD') as CurrencyCode,
  status: data.status as TransactionStatus,
  destination: data.destination ?? '',
  idempotencyKey: data.idempotencyKey ?? '',
  note: data.note,
  txHash: typeof data.txHash === 'string' ? data.txHash : null,
  reviewedBy: data.reviewedBy,
  reviewedAt: data.reviewedAt ? toIsoDate(data.reviewedAt) : undefined,
  createdAt: toIsoDate(data.createdAt),
  updatedAt: toIsoDate(data.updatedAt),
})

const mapTicket = (id: string, data: DocumentData): SupportTicket => ({
  id,
  userId: data.userId,
  subject: data.subject ?? '',
  body: data.body ?? '',
  category: data.category ?? 'other',
  status: data.status ?? 'open',
  priority: data.priority,
  assigneeId: data.assigneeId ?? null,
  createdAt: toIsoDate(data.createdAt),
  updatedAt: toIsoDate(data.updatedAt),
})

export interface AuditLogRecord {
  id: string
  actorId: string
  action: string
  resourceType: string
  resourceId: string
  createdAt: string
}

/* ---------- Current user ---------- */

export function fetchMyDeposits(userId: string, max = 10) {
  return runQuery(
    'deposits',
    [where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(max)],
    mapDeposit,
  )
}

export function fetchMyWithdrawals(userId: string, max = 10) {
  return runQuery(
    'withdrawals',
    [where('userId', '==', userId), orderBy('createdAt', 'desc'), limit(max)],
    mapWithdrawal,
  )
}

export function fetchMyTickets(userId: string, max = 20) {
  return runQuery(
    'supportTickets',
    [where('userId', '==', userId), orderBy('updatedAt', 'desc'), limit(max)],
    mapTicket,
  )
}

/* ---------- Admin (security rules allow admin reads) ---------- */

export function fetchDepositsByStatus(status: TransactionStatus, max = 50) {
  return runQuery(
    'deposits',
    [where('status', '==', status), orderBy('createdAt', 'desc'), limit(max)],
    mapDeposit,
  )
}

export function fetchWithdrawalsByStatus(status: TransactionStatus, max = 50) {
  return runQuery(
    'withdrawals',
    [where('status', '==', status), orderBy('createdAt', 'desc'), limit(max)],
    mapWithdrawal,
  )
}

export function fetchTicketsByStatus(status: SupportTicket['status'], max = 50) {
  return runQuery(
    'supportTickets',
    [where('status', '==', status), orderBy('updatedAt', 'desc'), limit(max)],
    mapTicket,
  )
}

export function fetchAuditLogs(max = 50) {
  return runQuery('auditLogs', [orderBy('createdAt', 'desc'), limit(max)], (id, data) => ({
    id,
    actorId: data.actorId ?? '',
    action: data.action ?? '',
    resourceType: data.resourceType ?? '',
    resourceId: data.resourceId ?? '',
    createdAt: toIsoDate(data.createdAt),
  }) satisfies AuditLogRecord)
}
