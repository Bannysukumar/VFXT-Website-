import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDownToLine, Check, ExternalLink, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { SkeletonRows } from '@/components/shared/stat-card'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import {
  ApproveDepositDialog,
  IdCell,
  RejectDialog,
  StatusTabs,
} from '@/features/admin/components/admin-ui'
import { AdminFiltersBar } from '@/features/admin/components/admin-filters'
import { formatMinor } from '@/lib/money'
import { exportRowsToCsv, exportRowsToExcel } from '@/lib/export-table'
import { approveDeposit, rejectDeposit } from '@/services/admin-service'
import { fetchDepositsByStatus } from '@/services/records-service'
import type { DepositRequest, TransactionStatus } from '@/types/models'

const tabs: { value: TransactionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function isVfxtDeposit(row: DepositRequest) {
  return row.currency === 'VFXT' || row.method === 'vfxt_bep20' || row.tokenSymbol === 'VFXT'
}

function requestedLabel(row: DepositRequest) {
  return isVfxtDeposit(row)
    ? `${formatMinor(row.amountMinor, { scale: 0 })} VFXT`
    : formatMinor(row.amountMinor, { scale: 2, currency: 'USD' })
}

function defaultHumanAmount(row: DepositRequest): string {
  if (row.suggestedCreditMinor != null && row.suggestedCreditMinor > 0) {
    return isVfxtDeposit(row)
      ? String(row.suggestedCreditMinor)
      : (row.suggestedCreditMinor / 100).toFixed(2)
  }
  if (row.observedUsdCents != null && row.observedUsdCents > 0 && !isVfxtDeposit(row)) {
    return (row.observedUsdCents / 100).toFixed(2)
  }
  return isVfxtDeposit(row)
    ? String(row.amountMinor)
    : (row.amountMinor / 100).toFixed(2)
}

function parseCreditMinor(row: DepositRequest, human: string): number {
  const n = Number(human.replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Enter a valid credit amount')
  }
  if (isVfxtDeposit(row)) {
    const tokens = Math.floor(n)
    if (tokens < 1) throw new Error('VFXT credit must be at least 1 token')
    return tokens
  }
  const cents = Math.round(n * 100)
  if (cents < 1) throw new Error('USDT credit must be at least $0.01')
  return cents
}

export function AdminDepositsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<TransactionStatus>('pending')
  const [search, setSearch] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [approving, setApproving] = useState<DepositRequest | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'deposits', status],
    queryFn: () => fetchDepositsByStatus(status),
  })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'deposits'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
    ])

  const approve = useMutation({
    mutationFn: ({ id, creditAmountMinor }: { id: string; creditAmountMinor: number }) => {
      setBusyId(id)
      return approveDeposit(id, crypto.randomUUID(), creditAmountMinor)
    },
    onSuccess: async () => {
      toast.success('Deposit approved and credited')
      setApproving(null)
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectDeposit(id, reason),
    onSuccess: async () => {
      toast.success('Deposit rejected')
      setRejecting(null)
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const allRows = query.data ?? []
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allRows
    return allRows.filter((r) =>
      [
        r.id,
        r.userId,
        r.note,
        r.status,
        r.txHash,
        r.manualReviewReason,
        String(r.amountMinor),
      ].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(term),
      ),
    )
  }, [allRows, search])
  const totalUsdt = rows
    .filter((r) => !isVfxtDeposit(r))
    .reduce((sum, r) => sum + r.amountMinor, 0)
  const totalVfxt = rows
    .filter((r) => isVfxtDeposit(r))
    .reduce((sum, r) => sum + r.amountMinor, 0)
  const exportCols = [
    { key: 'id', label: 'Deposit ID' },
    { key: 'userId', label: 'User' },
    { key: 'amountMinor', label: 'Amount minor' },
    { key: 'status', label: 'Status' },
    { key: 'txHash', label: 'Tx hash' },
    { key: 'manualReviewReason', label: 'Review reason' },
    { key: 'note', label: 'Note' },
    { key: 'createdAt', label: 'Created' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Deposit requests"
        description="Pending includes manual reviews (underpaid / unmatched tx hashes). Enter the credit amount when approving."
      />
      <StatusTabs value={status} onChange={setStatus} options={tabs} layoutId="deposit-tabs" />
      <AdminFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deposit ID, user, tx, note…"
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        resultCount={rows.length}
        exportDisabled={rows.length === 0}
        onExportCsv={() =>
          exportRowsToCsv(
            `vfxt-deposits-${status}-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            rows as unknown as Array<Record<string, unknown>>,
          )
        }
        onExportExcel={() =>
          exportRowsToExcel(
            `vfxt-deposits-${status}-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            rows as unknown as Array<Record<string, unknown>>,
            'Deposits',
          )
        }
        extra={
          rows.length > 0 ? (
            <p className="text-sm text-ink-muted">
              {totalUsdt > 0 ? (
                <>
                  USDT{' '}
                  <span className="tabular font-semibold text-ink">
                    {formatMinor(totalUsdt, { scale: 2, currency: 'USD' })}
                  </span>
                </>
              ) : null}
              {totalUsdt > 0 && totalVfxt > 0 ? ' · ' : null}
              {totalVfxt > 0 ? (
                <>
                  VFXT{' '}
                  <span className="tabular font-semibold text-ink">
                    {formatMinor(totalVfxt, { scale: 0 })}
                  </span>
                </>
              ) : null}
            </p>
          ) : null
        }
      />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {query.isLoading ? (
            <SkeletonRows rows={5} />
          ) : query.isError ? (
            <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={ArrowDownToLine}
                title={`No ${status} deposits`}
                description="Requests matching this status will appear here."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Submitted</TH>
                  <TH>Deposit</TH>
                  <TH>User</TH>
                  <TH>Payment / note</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Amount</TH>
                  {status === 'pending' ? <TH className="text-right">Actions</TH> : null}
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-ink-muted">
                      {format(new Date(row.createdAt), 'MMM d, p')}
                    </TD>
                    <TD>
                      <IdCell id={row.id} label="Deposit ID" />
                    </TD>
                    <TD>
                      <IdCell id={row.userId} label="User ID" />
                    </TD>
                    <TD className="max-w-56">
                      <div className="space-y-1">
                        {row.manualReview ? (
                          <p className="text-xs font-medium text-accent">Manual review</p>
                        ) : null}
                        {row.observedAmountDisplay ? (
                          <p className="text-xs text-ink">
                            On-chain: {row.observedAmountDisplay}{' '}
                            {isVfxtDeposit(row) ? 'VFXT' : 'USDT'}
                          </p>
                        ) : null}
                        {row.txHash ? (
                          <a
                            href={`https://bscscan.com/tx/${row.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-accent hover:underline"
                          >
                            {row.txHash.slice(0, 10)}…
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <p className="max-w-48 truncate text-ink-muted">{row.note || '—'}</p>
                        )}
                        {row.manualReviewReason ? (
                          <p className="line-clamp-2 text-[11px] text-ink-muted">
                            {row.manualReviewReason}
                          </p>
                        ) : null}
                      </div>
                    </TD>
                    <TD>
                      <StatusBadge status={row.status} />
                    </TD>
                    <TD className="tabular text-right font-semibold">{requestedLabel(row)}</TD>
                    {status === 'pending' ? (
                      <TD>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRejecting(row.id)}>
                            <X />
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="accent"
                            disabled={busyId === row.id}
                            onClick={() => setApproving(row)}
                          >
                            {busyId === row.id ? <Loader2 className="animate-spin" /> : <Check />}
                            Approve
                          </Button>
                        </div>
                      </TD>
                    ) : null}
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <RejectDialog
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        title="Reject deposit"
        pending={reject.isPending}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting, reason })}
      />
      {approving ? (
        <ApproveDepositDialog
          open
          onOpenChange={(open) => !open && setApproving(null)}
          pending={approve.isPending}
          assetLabel={isVfxtDeposit(approving) ? 'VFXT' : 'USDT'}
          requestedLabel={requestedLabel(approving)}
          observedLabel={
            approving.observedAmountDisplay
              ? `${approving.observedAmountDisplay} ${isVfxtDeposit(approving) ? 'VFXT' : 'USDT'}`
              : null
          }
          reason={approving.manualReviewReason}
          txHash={approving.txHash}
          defaultAmount={defaultHumanAmount(approving)}
          amountHint={
            isVfxtDeposit(approving)
              ? 'Credit amount (VFXT tokens)'
              : 'Credit amount (USDT / USD)'
          }
          onConfirm={(human) => {
            try {
              const creditAmountMinor = parseCreditMinor(approving, human)
              approve.mutate({ id: approving.id, creditAmountMinor })
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Invalid amount')
            }
          }}
        />
      ) : null}
    </div>
  )
}
