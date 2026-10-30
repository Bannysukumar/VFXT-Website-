import { useState } from 'react'
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
import { formatMinor } from '@/lib/money'
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

  const rows = query.data ?? []
  const total = rows.reduce((sum, r) => sum + r.amountMinor, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Deposit requests"
        description="Approving a deposit writes an atomic ledger credit to the user's wallet."
      />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <StatusTabs value={status} onChange={setStatus} options={tabs} layoutId="deposit-tabs" />
        {rows.length > 0 ? (
          <p className="text-sm text-ink-muted">
            {rows.length} request{rows.length === 1 ? '' : 's'} ·{' '}
            <span className="tabular font-semibold text-ink">{formatMinor(total, { scale: 2, currency: 'USD' })}</span>
          </p>
        ) : null}
      </div>
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
                      {formatMinor(row.amountMinor, { scale: 2, currency: row.currency === 'USD' ? 'USD' : undefined })}
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
