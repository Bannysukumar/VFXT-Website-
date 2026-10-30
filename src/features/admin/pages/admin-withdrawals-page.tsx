import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowUpFromLine, Check, CheckCheck, Loader2, X } from 'lucide-react'
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
import { approveWithdrawal, completeWithdrawal, rejectWithdrawal } from '@/services/admin-service'
import { fetchWithdrawalsByStatus } from '@/services/records-service'
import type { TransactionStatus } from '@/types/models'

const tabs: { value: TransactionStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
]

export function AdminWithdrawalsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<TransactionStatus>('pending')
  const [search, setSearch] = useState('')
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'withdrawals', status],
    queryFn: () => fetchWithdrawalsByStatus(status),
  })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'withdrawals'] }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
    ])

  const action = useMutation({
    mutationFn: ({ id, kind }: { id: string; kind: 'approve' | 'complete' }) => {
      setBusyId(id)
      return kind === 'approve' ? approveWithdrawal(id) : completeWithdrawal(id, crypto.randomUUID())
    },
    onSuccess: async (_, { kind }) => {
      toast.success(kind === 'approve' ? 'Withdrawal approved' : 'Withdrawal completed')
      await refresh()
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setBusyId(null),
  })

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectWithdrawal(id, reason),
    onSuccess: async () => {
      toast.success('Withdrawal rejected — funds released')
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
      [r.id, r.userId, r.destination, r.status, String(r.amountMinor)].some((v) =>
        String(v ?? '')
          .toLowerCase()
          .includes(term),
      ),
    )
  }, [allRows, search])
  const actionable = ['pending', 'approved', 'processing'].includes(status)
  const exportCols = [
    { key: 'id', label: 'Withdrawal ID' },
    { key: 'userId', label: 'User' },
    { key: 'destination', label: 'Destination' },
    { key: 'amountMinor', label: 'Amount minor' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Withdrawal requests"
        description="Approve, complete, or reject withdrawals. Rejections release reserved funds back to the user."
      />
      <StatusTabs value={status} onChange={setStatus} options={tabs} layoutId="withdrawal-tabs" />
      <AdminFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search withdrawal, user, destination…"
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        resultCount={rows.length}
        exportDisabled={rows.length === 0}
        onExportCsv={() =>
          exportRowsToCsv(
            `vfxt-withdrawals-${status}-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            rows as unknown as Array<Record<string, unknown>>,
          )
        }
        onExportExcel={() =>
          exportRowsToExcel(
            `vfxt-withdrawals-${status}-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            rows as unknown as Array<Record<string, unknown>>,
            'Withdrawals',
          )
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
              <EmptyState icon={ArrowUpFromLine} title={`No ${status} withdrawals`} description="Requests matching this status will appear here." />
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Submitted</TH>
                  <TH>Withdrawal</TH>
                  <TH>User</TH>
                  <TH>Destination</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Amount</TH>
                  {actionable ? <TH className="text-right">Actions</TH> : null}
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-ink-muted">{format(new Date(row.createdAt), 'MMM d, p')}</TD>
                    <TD>
                      <IdCell id={row.id} label="Withdrawal ID" />
                    </TD>
                    <TD>
                      <IdCell id={row.userId} label="User ID" />
                    </TD>
                    <TD className="max-w-48 truncate font-mono text-xs">{row.destination || '—'}</TD>
                    <TD>
                      <StatusBadge status={row.status} />
                    </TD>
                    <TD className="tabular text-right font-semibold">
                      {formatMinor(row.amountMinor, { scale: 2, currency: row.currency === 'USD' ? 'USD' : undefined })}
                    </TD>
                    {actionable ? (
                      <TD>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => setRejecting(row.id)}>
                            <X />
                            Reject
                          </Button>
                          {row.status === 'pending' ? (
                            <Button size="sm" variant="default" disabled={busyId === row.id} onClick={() => action.mutate({ id: row.id, kind: 'approve' })}>
                              {busyId === row.id ? <Loader2 className="animate-spin" /> : <Check />}
                              Approve
                            </Button>
                          ) : (
                            <Button size="sm" variant="accent" disabled={busyId === row.id} onClick={() => action.mutate({ id: row.id, kind: 'complete' })}>
                              {busyId === row.id ? <Loader2 className="animate-spin" /> : <CheckCheck />}
                              Complete
                            </Button>
                          )}
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
        title="Reject withdrawal"
        pending={reject.isPending}
        onConfirm={(reason) => rejecting && reject.mutate({ id: rejecting, reason })}
      />
    </div>
  )
}
