import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDownToLine, Check, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { SkeletonRows } from '@/components/shared/stat-card'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { IdCell, RejectDialog, StatusTabs } from '@/features/admin/components/admin-ui'
import { AdminFiltersBar } from '@/features/admin/components/admin-filters'
import { formatMinor } from '@/lib/money'
import { exportRowsToCsv, exportRowsToExcel } from '@/lib/export-table'
import { approveDeposit, rejectDeposit } from '@/services/admin-service'
import { fetchDepositsByStatus } from '@/services/records-service'
import type { TransactionStatus } from '@/types/models'

const tabs: { value: TransactionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

export function AdminDepositsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<TransactionStatus>('pending')
  const [search, setSearch] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
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
    mutationFn: (id: string) => {
      setBusyId(id)
      return approveDeposit(id, crypto.randomUUID())
    },
    onSuccess: async () => {
      toast.success('Deposit approved and credited')
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
      [r.id, r.userId, r.note, r.status, String(r.amountMinor)].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(term),
      ),
    )
  }, [allRows, search])
  const totalUsdt = rows
    .filter((r) => r.currency !== 'VFXT')
    .reduce((sum, r) => sum + r.amountMinor, 0)
  const totalVfxt = rows
    .filter((r) => r.currency === 'VFXT')
    .reduce((sum, r) => sum + r.amountMinor, 0)
  const exportCols = [
    { key: 'id', label: 'Deposit ID' },
    { key: 'userId', label: 'User' },
    { key: 'amountMinor', label: 'Amount minor' },
    { key: 'status', label: 'Status' },
    { key: 'note', label: 'Note' },
    { key: 'createdAt', label: 'Created' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Deposit requests"
        description="USDT deposits convert to VFXT Fund credit on approve. VFXT deposits credit Fund 1:1."
      />
      <StatusTabs value={status} onChange={setStatus} options={tabs} layoutId="deposit-tabs" />
      <AdminFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search deposit ID, user, note…"
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
              <EmptyState icon={ArrowDownToLine} title={`No ${status} deposits`} description="Requests matching this status will appear here." />
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Submitted</TH>
                  <TH>Deposit</TH>
                  <TH>User</TH>
                  <TH>Note</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Amount</TH>
                  {status === 'pending' ? <TH className="text-right">Actions</TH> : null}
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-ink-muted">{format(new Date(row.createdAt), 'MMM d, p')}</TD>
                    <TD>
                      <IdCell id={row.id} label="Deposit ID" />
                    </TD>
                    <TD>
                      <IdCell id={row.userId} label="User ID" />
                    </TD>
                    <TD className="max-w-48 truncate text-ink-muted">{row.note || '—'}</TD>
                    <TD>
                      <StatusBadge status={row.status} />
                    </TD>
                    <TD className="tabular text-right font-semibold">
                      {row.currency === 'VFXT'
                        ? `${formatMinor(row.amountMinor, { scale: 0 })} VFXT`
                        : formatMinor(row.amountMinor, { scale: 2, currency: 'USD' })}
                    </TD>
                    {status === 'pending' ? (
                      <TD>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRejecting(row.id)}>
                            <X />
                            Reject
                          </Button>
                          <Button size="sm" variant="accent" disabled={busyId === row.id} onClick={() => approve.mutate(row.id)}>
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
    </div>
  )
}
