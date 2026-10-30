import { format } from 'date-fns'
import { AdminHistoryTable, type HistoryColumn } from '@/features/admin/components/admin-history-table'
import { adminListAutoDeposits } from '@/services/admin-service'
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
    label: 'Amount',
    align: 'right',
    render: (r) =>
      formatMinor(Number(r.amountMinor ?? 0), { scale: 2, currency: 'USD' }),
  },
  {
    key: 'vfxtTokensCredited',
    label: 'VFXT credited',
    align: 'right',
    render: (r) =>
      r.vfxtTokensCredited != null
        ? Number(r.vfxtTokensCredited).toLocaleString()
        : '—',
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
  { key: 'status', label: 'Status' },
  {
    key: 'reviewedBy',
    label: 'Credited by',
    render: (r) => <span className="text-xs text-ink-muted">{String(r.reviewedBy ?? '—')}</span>,
  },
]

export function AdminAutoDepositsPage() {
  return (
    <AdminHistoryTable
      title="Automatic deposits"
      description="USDT BEP-20 deposits verified on-chain and credited automatically."
      queryKey={['admin', 'auto-deposits']}
      queryFn={async () => {
        const res = await adminListAutoDeposits()
        return { rows: res.rows }
      }}
      columns={columns}
      emptyTitle="No automatic deposits yet"
      exportBasename={`vfxt-auto-deposits-${new Date().toISOString().slice(0, 10)}`}
    />
  )
}
