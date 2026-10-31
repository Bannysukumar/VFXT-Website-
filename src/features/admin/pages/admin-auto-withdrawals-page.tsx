import { format } from 'date-fns'
import { AdminHistoryTable, type HistoryColumn } from '@/features/admin/components/admin-history-table'
import { adminListAutoWithdrawals } from '@/services/admin-service'
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
    label: 'Wallet',
    render: (r) =>
      r.destination ? (
        <span className="font-mono text-xs" title={String(r.destination)}>
          {String(r.destination).slice(0, 8)}…{String(r.destination).slice(-6)}
        </span>
      ) : (
        '—'
      ),
  },
  {
    key: 'txHash',
    label: 'Transaction',
    render: (r) => <BscTxLink txHash={r.txHash ? String(r.txHash) : null} compact />,
  },
  {
    key: 'status',
    label: 'Status',
    render: () => <StatusPill status="completed" />,
  },
  {
    key: 'reviewedBy',
    label: 'Sent by',
    render: (r) => <ActorCell value={r.reviewedBy} />,
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
