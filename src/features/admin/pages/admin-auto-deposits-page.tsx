import { format } from 'date-fns'
import { AdminHistoryTable, type HistoryColumn } from '@/features/admin/components/admin-history-table'
import { adminListAutoDeposits } from '@/services/admin-service'
import { formatMinor } from '@/lib/money'
import { ActorCell, StatusPill, UserCell } from '@/features/admin/components/admin-ui'
import { BscTxLink } from '@/components/shared/bsc-tx-link'

const columns: HistoryColumn[] = [
  {
    key: 'createdAt',
    label: 'When',
    render: (r) =>
      r.createdAt ? format(new Date(String(r.createdAt)), 'dd MMM yyyy HH:mm') : '—',
  },
  {
    key: 'userId',
    label: 'Member',
    render: (r) => (
      <UserCell
        userId={String(r.userId ?? '')}
        email={r.userEmail ? String(r.userEmail) : null}
        displayName={r.userDisplayName ? String(r.userDisplayName) : null}
      />
    ),
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
        ? `${Number(r.vfxtTokensCredited).toLocaleString()} VFXT`
        : '—',
  },
  {
    key: 'txHash',
    label: 'Transaction',
    render: (r) => <BscTxLink txHash={r.txHash ? String(r.txHash) : null} compact />,
  },
  {
    key: 'status',
    label: 'Status',
    render: (r) => <StatusPill status={r.status} />,
  },
  {
    key: 'reviewedBy',
    label: 'Credited by',
    render: (r) => <ActorCell value={r.reviewedBy} />,
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
