import { format } from 'date-fns'
import { AdminHistoryTable, type HistoryColumn } from '@/features/admin/components/admin-history-table'
import { adminListAutoWithdrawals } from '@/services/admin-service'
import { formatMinor } from '@/lib/money'
import { IdCell } from '@/features/admin/components/admin-ui'

const columns: HistoryColumn[] = [
  {
    key: 'createdAt',
    label: 'When',
    render: (r) =>
      r.createdAt ? format(new Date(String(r.createdAt)), 'dd MMM yyyy HH:mm') : '—',
  },
  {
    key: 'userId',
    label: 'User',
    render: (r) => <IdCell id={String(r.userId ?? '')} label="User ID" />,
  },
  {
    key: 'amountMinor',
    label: 'Gross',
    align: 'right',
    render: (r) =>
      formatMinor(Number(r.amountMinor ?? 0), { scale: 2, currency: 'USD' }),
  },
  {
    key: 'commissionMinor',
    label: 'Fee',
    align: 'right',
    render: (r) =>
      formatMinor(Number(r.commissionMinor ?? 0), { scale: 2, currency: 'USD' }),
  },
  {
    key: 'netAmountMinor',
    label: 'Net sent',
    align: 'right',
    render: (r) =>
      formatMinor(Number(r.netAmountMinor ?? 0), { scale: 2, currency: 'USD' }),
  },
  {
    key: 'destination',
    label: 'To',
    render: (r) =>
      r.destination ? (
        <span className="font-mono text-xs">{String(r.destination).slice(0, 12)}…</span>
      ) : (
        '—'
      ),
  },
  {
    key: 'txHash',
    label: 'Tx hash',
    render: (r) =>
      r.txHash ? (
        <span className="font-mono text-xs">{String(r.txHash).slice(0, 14)}…</span>
      ) : (
        '—'
      ),
  },
  {
    key: 'reviewedBy',
    label: 'Sent by',
    render: (r) => <span className="text-xs text-ink-muted">{String(r.reviewedBy ?? '—')}</span>,
  },
]

export function AdminAutoWithdrawalsPage() {
  return (
    <AdminHistoryTable
      title="Automatic withdrawals"
      description="Completed USDT BEP-20 withdrawals sent by the hot wallet / auto-withdraw."
      queryKey={['admin', 'auto-withdrawals']}
      queryFn={async () => {
        const res = await adminListAutoWithdrawals()
        return { rows: res.rows }
      }}
      columns={columns}
      emptyTitle="No automatic withdrawals yet"
      exportBasename={`vfxt-auto-withdrawals-${new Date().toISOString().slice(0, 10)}`}
    />
  )
}
