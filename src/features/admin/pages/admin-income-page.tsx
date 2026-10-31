import { format } from 'date-fns'
import { useParams } from 'react-router-dom'
import { AdminHistoryTable, type HistoryColumn } from '@/features/admin/components/admin-history-table'
import {
  adminListIncomeByType,
  type AdminIncomeType,
} from '@/services/admin-service'
import { formatMinor } from '@/lib/money'
import { UserCell } from '@/features/admin/components/admin-ui'
import { ErrorState } from '@/components/shared/error-state'

export const INCOME_PAGES: Record<
  string,
  { type: AdminIncomeType; title: string; description: string; currency: 'USD' | 'VFXT' }
> = {
  roi: {
    type: 'roi',
    title: 'Daily ROI income',
    description: 'All daily yield (ROI) credits paid to users.',
    currency: 'USD',
  },
  'level-commission': {
    type: 'level_commission',
    title: 'Level commission income',
    description: 'Seven-level affiliate commission credits.',
    currency: 'USD',
  },
  'direct-bonus': {
    type: 'direct_bonus',
    title: 'Direct bonus income',
    description: 'Direct referral bonus credits.',
    currency: 'VFXT',
  },
  'referral-bonus': {
    type: 'referral_bonus',
    title: 'Referral bonus income',
    description: 'Referral bonus ledger credits.',
    currency: 'USD',
  },
  'rank-reward': {
    type: 'rank_reward',
    title: 'Rank reward income',
    description: 'Binary rank reward payouts.',
    currency: 'USD',
  },
  'staking-reward': {
    type: 'staking_reward',
    title: 'Staking reward income',
    description: 'Staking reward credits.',
    currency: 'USD',
  },
  'locked-maturity': {
    type: 'locked_maturity',
    title: 'Locked maturity income',
    description: 'Locked package maturity payouts.',
    currency: 'USD',
  },
  'locked-bonus': {
    type: 'locked_bonus',
    title: 'Locked bonus income',
    description: 'Locked package VFXT bonus credits.',
    currency: 'VFXT',
  },
  'deposit-credit': {
    type: 'deposit_credit',
    title: 'Deposit credit income',
    description: 'Fund wallet credits from deposits (manual and automatic).',
    currency: 'USD',
  },
}

const columnsFor = (currency: 'USD' | 'VFXT'): HistoryColumn[] => [
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
    render: (r) => {
      const n = Number(r.amountMinor ?? 0)
      if (currency === 'VFXT') {
        return `${formatMinor(n, { scale: 0 })} VFXT`
      }
      return formatMinor(n, { scale: 2, currency: 'USD' })
    },
  },
  {
    key: 'description',
    label: 'Details',
    render: (r) => (
      <span className="max-w-[320px] text-sm text-ink-muted" title={String(r.description ?? '')}>
        {String(r.description ?? '—')}
      </span>
    ),
  },
]

export function AdminIncomePage() {
  const { incomeType } = useParams<{ incomeType: string }>()
  const meta = incomeType ? INCOME_PAGES[incomeType] : undefined

  if (!meta) {
    return <ErrorState message={`Unknown income type: ${incomeType ?? ''}`} />
  }

  return (
    <AdminHistoryTable
      title={meta.title}
      description={meta.description}
      eyebrow="Income"
      queryKey={['admin', 'income', meta.type]}
      queryFn={async () => {
        const res = await adminListIncomeByType(meta.type)
        return { rows: res.rows, totalMinor: res.totalMinor }
      }}
      columns={columnsFor(meta.currency)}
      emptyTitle={`No ${meta.title.toLowerCase()} yet`}
      exportBasename={`vfxt-income-${meta.type}-${new Date().toISOString().slice(0, 10)}`}
      amountCurrency={meta.currency}
    />
  )
}
