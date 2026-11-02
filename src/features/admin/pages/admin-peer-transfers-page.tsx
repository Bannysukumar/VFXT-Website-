import { format } from 'date-fns'
import { AdminHistoryTable, type HistoryColumn } from '@/features/admin/components/admin-history-table'
import { adminListPeerTransfers } from '@/services/admin-service'
import { formatMinor } from '@/lib/money'
import { UserCell } from '@/features/admin/components/admin-ui'

const columns: HistoryColumn[] = [
  {
    key: 'createdAt',
    label: 'When',
    render: (r) =>
      r.createdAt ? format(new Date(String(r.createdAt)), 'dd MMM yyyy HH:mm') : '—',
  },
  {
    key: 'fromUserId',
    label: 'From (User ID)',
    render: (r) => (
      <div className="space-y-0.5">
        <p className="font-mono text-sm font-semibold">{String(r.fromUserId ?? '—')}</p>
        <UserCell
          userId={String(r.userId ?? '')}
          email={r.userEmail ? String(r.userEmail) : null}
          displayName={r.userDisplayName ? String(r.userDisplayName) : null}
        />
      </div>
    ),
  },
  {
    key: 'toUserId',
    label: 'To (User ID)',
    render: (r) => (
      <div className="space-y-0.5">
        <p className="font-mono text-sm font-semibold">{String(r.toUserId ?? '—')}</p>
        <UserCell
          userId={String(r.toUid ?? '')}
          email={r.toUserEmail ? String(r.toUserEmail) : null}
          displayName={r.toUserDisplayName ? String(r.toUserDisplayName) : null}
        />
      </div>
    ),
  },
  {
    key: 'walletKind',
    label: 'Wallet',
    render: (r) => (
      <span className="capitalize">{String(r.walletKind ?? '—').replaceAll('_', ' ')}</span>
    ),
  },
  {
    key: 'amountMinor',
    label: 'Amount',
    align: 'right',
    render: (r) => {
      const n = Number(r.amountMinor ?? 0)
      // Peer transfers are VFXT after tokens-only; keep USD fallback for legacy rows.
      if (String(r.currency) === 'USD') {
        return formatMinor(n, { scale: 2, currency: 'USD' })
      }
      return `${formatMinor(n, { scale: 0 })} VFXT`
    },
  },
  {
    key: 'note',
    label: 'Note',
    render: (r) => (r.note ? String(r.note) : '—'),
  },
]

export function AdminPeerTransfersPage() {
  return (
    <AdminHistoryTable
      title="User transfers"
      description="Member-to-member transfers by User ID (all wallets are VFXT tokens)."
      queryKey={['admin', 'peer-transfers']}
      queryFn={async () => {
        const res = await adminListPeerTransfers()
        return { rows: res.rows }
      }}
      columns={columns}
      emptyTitle="No peer transfers yet"
      exportBasename={`vfxt-peer-transfers-${new Date().toISOString().slice(0, 10)}`}
    />
  )
}
