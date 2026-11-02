import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarDays,
  CircleDollarSign,
  PiggyBank,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { PageHeader } from '@/components/shared/page-header'
import { StatCard, StatCardSkeleton } from '@/components/shared/stat-card'
import {
  getAdminTreasuryAnalytics,
  type TreasuryAnalytics,
  type TreasuryInvestedPeriod,
  type TreasuryPayoutWindow,
} from '@/services/admin-service'

function usd(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function vfxt(tokens: number) {
  return `${tokens.toLocaleString()} VFXT`
}

const PERIOD_OPTIONS: { value: TreasuryInvestedPeriod; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 days' },
  { value: 'last_30_days', label: 'Last 30 days' },
  { value: 'all', label: 'All time (active)' },
]

const WINDOW_OPTIONS: { value: TreasuryPayoutWindow; label: string }[] = [
  { value: 'tomorrow', label: 'Calendar tomorrow' },
  { value: 'next_24h', label: 'Next 24 hours' },
]

export function AdminAnalyticsPage() {
  const [investedPeriod, setInvestedPeriod] = useState<TreasuryInvestedPeriod>('today')
  const [payoutWindow, setPayoutWindow] = useState<TreasuryPayoutWindow>('tomorrow')
  const [includePending, setIncludePending] = useState(true)

  const analytics = useQuery({
    queryKey: ['admin', 'treasury-analytics', investedPeriod, payoutWindow, includePending],
    queryFn: () =>
      getAdminTreasuryAnalytics({
        investedPeriod,
        payoutWindow,
        includePendingWithdrawals: includePending,
        utcOffsetMinutes: 330,
      }),
  })

  const data = analytics.data

  const cards = useMemo(() => {
    if (!data) return []
    return buildCards(data, investedPeriod, payoutWindow)
  }, [data, investedPeriod, payoutWindow])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Finance"
        title="Treasury analytics"
        description="Investment inflows, tomorrow’s expected ROI cash-out, hot-wallet USDT, and how much USDT you need ready for users."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => analytics.refetch()}
            disabled={analytics.isFetching}
          >
            <RefreshCw className={`size-4 ${analytics.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Filters</CardTitle>
          <CardDescription>
            Times use India (UTC+5:30). Tomorrow ROI is daily-yield due in the selected window.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Invested period</Label>
            <NativeSelect
              value={investedPeriod}
              onChange={(e) => setInvestedPeriod(e.target.value as TreasuryInvestedPeriod)}
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Tomorrow payout window</Label>
            <NativeSelect
              value={payoutWindow}
              onChange={(e) => setPayoutWindow(e.target.value as TreasuryPayoutWindow)}
            >
              {WINDOW_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Pending withdrawals</Label>
            <NativeSelect
              value={includePending ? '1' : '0'}
              onChange={(e) => setIncludePending(e.target.value === '1')}
            >
              <option value="1">Include in required USDT</option>
              <option value="0">ROI only</option>
            </NativeSelect>
          </div>
          <div className="flex items-end">
            <p className="text-xs text-ink-muted">
              Rate:{' '}
              <span className="font-semibold text-ink">
                {(data?.tokensPerUsd ?? 10_000).toLocaleString()} VFXT / $1
              </span>
              {data?.generatedAt ? (
                <>
                  <br />
                  Updated {new Date(data.generatedAt).toLocaleString()}
                </>
              ) : null}
            </p>
          </div>
        </CardContent>
      </Card>

      {analytics.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : analytics.isError ? (
        <ErrorState message={analytics.error.message} onRetry={() => analytics.refetch()} />
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((card, i) => (
              <StatCard
                key={card.label}
                index={i}
                label={card.label}
                value={card.value}
                hint={card.hint}
                icon={card.icon}
                tone={card.tone}
                footer={card.footer}
              />
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-lg">Coverage check</CardTitle>
                <CardDescription>
                  Hot wallet USDT vs USDT needed for tomorrow’s user withdrawals.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Hot wallet USDT" value={usd(data.hotWallet.usdtCents)} />
                <Row
                  label="Tomorrow ROI (USDT equiv.)"
                  value={usd(data.tomorrowPayout.usdtCents)}
                />
                {includePending ? (
                  <Row
                    label="Open withdrawal queue"
                    value={usd(data.pendingWithdrawals.usdtCents)}
                  />
                ) : null}
                <Row label="Total required" value={usd(data.required.usdtCents)} strong />
                <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
                  <Badge variant={data.required.shortfallUsdtCents > 0 ? 'warning' : 'success'}>
                    {data.required.coveragePct}% covered
                  </Badge>
                  {data.required.shortfallUsdtCents > 0 ? (
                    <p className="flex items-center gap-1.5 text-sm text-warning">
                      <AlertTriangle className="size-4" />
                      Shortfall {usd(data.required.shortfallUsdtCents)} — top up hot wallet
                    </p>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      Surplus {usd(data.required.surplusUsdtCents)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-sans text-lg">Snapshot detail</CardTitle>
                <CardDescription>Token amounts behind the USDT figures.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Row label="Invested (period)" value={vfxt(data.invested.tokens)} />
                <Row label="Invested positions" value={String(data.invested.positions)} />
                <Row label="Active stake total" value={vfxt(data.totalActiveStake.tokens)} />
                <Row label="Tomorrow ROI tokens" value={vfxt(data.tomorrowPayout.tokens)} />
                <Row label="Users paid tomorrow" value={String(data.tomorrowPayout.users)} />
                <Row
                  label="Pending withdraw tokens"
                  value={vfxt(data.pendingWithdrawals.tokens)}
                />
                {!data.hotWallet.configured ? (
                  <p className="text-sm text-warning">Hot wallet not configured.</p>
                ) : data.hotWallet.address ? (
                  <p className="break-all font-mono text-xs text-ink-muted">
                    {data.hotWallet.address}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </>
      ) : (
        <LoadingState />
      )}
    </div>
  )
}

function Row({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? 'font-semibold tabular text-ink' : 'tabular text-ink'}>
        {value}
      </span>
    </div>
  )
}

function buildCards(
  data: TreasuryAnalytics,
  investedPeriod: TreasuryInvestedPeriod,
  payoutWindow: TreasuryPayoutWindow,
) {
  const periodLabel =
    PERIOD_OPTIONS.find((p) => p.value === investedPeriod)?.label ?? investedPeriod
  const windowLabel =
    WINDOW_OPTIONS.find((p) => p.value === payoutWindow)?.label ?? payoutWindow

  return [
    {
      label: `Invested (${periodLabel})`,
      value: vfxt(data.invested.tokens),
      hint: `${usd(data.invested.usdtCents)} · ${data.invested.positions} stakes`,
      icon: ArrowDownToLine,
      tone: 'accent' as const,
      footer: <span className="text-xs text-ink-muted">New stakes in selected period</span>,
    },
    {
      label: 'Total active investment',
      value: vfxt(data.totalActiveStake.tokens),
      hint: `${usd(data.totalActiveStake.usdtCents)} · ${data.totalActiveStake.positions} open`,
      icon: PiggyBank,
      tone: 'info' as const,
      footer: <span className="text-xs text-ink-muted">All active staking principal</span>,
    },
    {
      label: `Tomorrow withdraw (${windowLabel})`,
      value: vfxt(data.tomorrowPayout.tokens),
      hint: `${usd(data.tomorrowPayout.usdtCents)} · ${data.tomorrowPayout.users} users`,
      icon: CalendarDays,
      tone: 'warning' as const,
      footer: (
        <span className="text-xs text-ink-muted">
          Daily ROI due — users can move this to Withdrawal
        </span>
      ),
    },
    {
      label: 'USDT in hot wallet',
      value: usd(data.hotWallet.usdtCents),
      hint: data.hotWallet.configured ? 'On-chain balance' : 'Not configured',
      icon: Wallet,
      tone: 'accent' as const,
      footer: <span className="text-xs text-ink-muted">Available to send user payouts</span>,
    },
    {
      label: 'USDT required (tomorrow)',
      value: usd(data.required.usdtCents),
      hint: includeHint(data),
      icon: CircleDollarSign,
      tone: data.required.shortfallUsdtCents > 0 ? ('danger' as const) : ('info' as const),
      footer: (
        <span className="text-xs text-ink-muted">
          ROI{data.pendingWithdrawals.count > 0 ? ' + open withdrawals' : ''}
        </span>
      ),
    },
    {
      label: data.required.shortfallUsdtCents > 0 ? 'USDT shortfall' : 'USDT surplus',
      value: usd(
        data.required.shortfallUsdtCents > 0
          ? data.required.shortfallUsdtCents
          : data.required.surplusUsdtCents,
      ),
      hint: `${data.required.coveragePct}% of required covered`,
      icon: AlertTriangle,
      tone: data.required.shortfallUsdtCents > 0 ? ('danger' as const) : ('accent' as const),
      footer: (
        <span className="text-xs text-ink-muted">
          Hot wallet − required for tomorrow users
        </span>
      ),
    },
  ]
}

function includeHint(data: TreasuryAnalytics) {
  const parts = [`ROI ${usd(data.tomorrowPayout.usdtCents)}`]
  if (data.pendingWithdrawals.count > 0) {
    parts.push(`queue ${usd(data.pendingWithdrawals.usdtCents)}`)
  }
  return parts.join(' + ')
}
