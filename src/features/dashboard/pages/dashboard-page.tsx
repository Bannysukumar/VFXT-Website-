import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { format, formatDistanceToNow, subDays } from 'date-fns'
import {
  ArrowDownLeft,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  ArrowUpRight,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  LifeBuoy,
  Link2,
  Lock,
  Receipt,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { SkeletonRows, StatCard, StatCardSkeleton } from '@/components/shared/stat-card'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { images } from '@/lib/media'
import { toast } from 'sonner'
import { fetchUserLedger, fetchUserWallets } from '@/services/wallet-service'
import { fetchMyDeposits, fetchMyWithdrawals } from '@/services/records-service'
import { getAffiliateDashboard } from '@/services/plan-service'
import { CountUp } from '@/components/motion/reveal'
import { TypeText } from '@/components/motion/typing'

const outgoing = new Set(['withdrawal_debit', 'withdrawal_reserve', 'transfer_out', 'fee'])
const ranges = [
  { key: '7d', label: '7D', days: 7 },
  { key: '30d', label: '30D', days: 30 },
  { key: 'all', label: 'All', days: null },
] as const

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const userId = user?.uid ?? ''
  const [range, setRange] = useState<(typeof ranges)[number]['key']>('all')

  const walletsQuery = useQuery({
    queryKey: ['wallets', userId],
    queryFn: () => fetchUserWallets(userId),
    enabled: Boolean(userId),
  })
  const ledgerQuery = useQuery({
    queryKey: ['ledger', userId],
    queryFn: () => fetchUserLedger(userId, 30),
    enabled: Boolean(userId),
  })
  const depositsQuery = useQuery({
    queryKey: ['my-deposits', userId],
    queryFn: () => fetchMyDeposits(userId, 10),
    enabled: Boolean(userId),
  })
  const withdrawalsQuery = useQuery({
    queryKey: ['my-withdrawals', userId],
    queryFn: () => fetchMyWithdrawals(userId, 10),
    enabled: Boolean(userId),
  })
  const affiliateQuery = useQuery({
    queryKey: ['affiliate', userId],
    queryFn: getAffiliateDashboard,
    enabled: Boolean(userId),
  })

  const wallets = walletsQuery.data ?? []
  const referralCode = affiliateQuery.data?.referralCode
  const referralLink = referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?ref=${referralCode}`
    : null
  const ledger = useMemo(() => ledgerQuery.data ?? [], [ledgerQuery.data])
  const primary = wallets.find((w) => w.currency === 'USD') ?? wallets[0]
  const primaryCurrency = primary?.currency === 'USD' ? 'USD' : undefined
  const scale = primary?.scale ?? 2
  const firstName = (user?.displayName || '').split(' ')[0]

  const pending = [
    ...(depositsQuery.data ?? [])
      .filter((d) => d.status === 'pending')
      .map((d) => ({ kind: 'Deposit' as const, ...d })),
    ...(withdrawalsQuery.data ?? [])
      .filter((w) => ['pending', 'approved', 'processing'].includes(w.status))
      .map((w) => ({ kind: 'Withdrawal' as const, ...w })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const chartData = useMemo(() => {
    const days = ranges.find((r) => r.key === range)?.days
    const cutoff = days ? subDays(new Date(), days) : null
    return [...ledger]
      .reverse()
      .filter((entry) => !cutoff || new Date(entry.createdAt) >= cutoff)
      .map((entry) => ({
        label: format(new Date(entry.createdAt), 'MMM d'),
        available: entry.balanceAfterAvailableMinor / 10 ** scale,
      }))
  }, [ledger, range, scale])

  const checklist = [
    { label: 'Create your account', done: true },
    { label: 'Verify your email address', done: Boolean(user?.emailVerified) },
    { label: 'Wallets provisioned', done: wallets.length > 0 },
    { label: 'Make your first deposit', done: ledger.some((e) => e.type === 'deposit_credit') },
  ]
  const completed = checklist.filter((c) => c.done).length

  if (walletsQuery.isError) {
    return <ErrorState message={walletsQuery.error.message} onRetry={() => walletsQuery.refetch()} />
  }

  const loading = walletsQuery.isLoading || ledgerQuery.isLoading
  const money = (minor: number) => formatMinor(minor, { scale, currency: primaryCurrency })

  return (
    <div className="space-y-6">
      {/* Welcome banner */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative isolate overflow-hidden rounded-3xl bg-brand p-6 text-white shadow-lift sm:p-8"
      >
        <img src={images.laptopChart} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand via-brand/90 to-brand/40" />
        <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-white/60">
              <TypeText text={`${greeting()}${firstName ? `, ${firstName}` : ''}`} speed={45} delay={250} />
            </p>
            <p className="mt-4 text-sm text-white/60">Available balance</p>
            {loading ? (
              <div className="mt-2 h-12 w-56 animate-pulse rounded-lg bg-white/10" />
            ) : (
              <p className="tabular mt-1 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
                {primary ? <CountUp value={primary.availableMinor} format={money} /> : '—'}
              </p>
            )}
            <p className="mt-2 flex items-center gap-2 text-sm text-white/60">
              <Lock className="size-3.5" />
              {primary ? `${money(primary.reservedMinor)} reserved` : 'Wallet not yet provisioned'}
            </p>
          </div>
          <div className="grid w-full grid-cols-4 gap-2 sm:w-auto sm:gap-3">
            {[
              { to: '/app/deposits', label: 'Deposit', icon: ArrowDownToLine, primary: true },
              { to: '/app/withdrawals', label: 'Withdraw', icon: ArrowUpFromLine },
              { to: '/app/wallets', label: 'Wallets', icon: Wallet },
              { to: '/app/support', label: 'Support', icon: LifeBuoy },
            ].map(({ to, label, icon: Icon, primary: isPrimary }) => (
              <Link
                key={to}
                to={to}
                className="group flex flex-col items-center gap-2 text-xs font-medium text-white/80 hover:text-white"
              >
                <span
                  className={cn(
                    'grid size-12 place-items-center rounded-2xl border transition-[transform,background-color,border-color,color] duration-200 group-hover:-translate-y-0.5 sm:size-14',
                    isPrimary
                      ? 'border-transparent bg-accent text-white shadow-lg shadow-accent/30'
                      : 'border-white/15 bg-white/10 backdrop-blur group-hover:bg-white/20',
                  )}
                >
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            ))}
          </div>
        </div>
      </motion.section>

      {referralLink ? (
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <div>
              <CardDescription>Your unique referral link</CardDescription>
              <CardTitle className="mt-1 flex items-center gap-2 font-sans text-base">
                <Link2 className="size-4 text-accent" />
                Invite members under you
              </CardTitle>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(referralLink)
                  toast.success('Referral link copied')
                }}
              >
                <Copy className="size-3.5" />
                Copy link
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!referralCode) return
                  await navigator.clipboard.writeText(referralCode)
                  toast.success('Referral code copied')
                }}
              >
                Copy code
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/app/referrals">Affiliate</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="break-all rounded-xl border border-line bg-canvas px-3 py-2 font-mono text-xs text-ink-muted">
              {referralLink}
            </p>
            <p className="mt-2 text-xs text-ink-subtle">
              Code <span className="font-mono font-semibold text-ink">{referralCode}</span> (required
              when someone registers).
            </p>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard index={0} label="Available" icon={Wallet} value={primary ? primary.availableMinor : '—'} format={money} hint={primary ? `${primary.currency} wallet` : 'No wallet yet'} />
            <StatCard index={1} label="Reserved" icon={Lock} tone="warning" value={primary ? primary.reservedMinor : '—'} format={money} hint="Held for in-flight withdrawals" />
            <StatCard index={2} label="Pending requests" icon={Clock} tone="info" value={pending.length} hint="Awaiting admin review" />
            <StatCard index={3} label="Ledger entries" icon={Receipt} tone="neutral" value={ledger.length} hint="Most recent 30 loaded" />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {/* Chart */}
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Balance trend</CardTitle>
              <CardDescription>Available balance from confirmed ledger snapshots.</CardDescription>
            </div>
            <div className="flex rounded-lg border border-line bg-panel-elevated p-1">
              {ranges.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setRange(r.key)}
                  className={cn(
                    'relative rounded-md px-3 py-1 text-xs font-semibold transition-colors',
                    range === r.key ? 'text-ink' : 'text-ink-muted hover:text-ink',
                  )}
                >
                  {range === r.key ? (
                    <motion.span layoutId="range-pill" className="absolute inset-0 rounded-md bg-panel shadow-xs" />
                  ) : null}
                  <span className="relative">{r.label}</span>
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="h-80">
            {loading ? (
              <div className="skeleton size-full rounded-xl" />
            ) : chartData.length === 0 ? (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-line-strong bg-canvas text-center">
                <div>
                  <Receipt className="mx-auto size-8 text-ink-subtle" />
                  <p className="mt-3 text-sm font-medium">No activity in this range</p>
                  <p className="text-xs text-ink-muted">Your chart appears after your first transaction.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ left: -8, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="avail" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" style={{ stopColor: 'var(--color-accent)' }} stopOpacity={0.3} />
                      <stop offset="100%" style={{ stopColor: 'var(--color-accent)' }} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-rule)" vertical={false} />
                  <XAxis dataKey="label" stroke="var(--color-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--color-subtle)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ stroke: 'var(--color-accent)', strokeDasharray: '4 4' }}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid var(--color-rule)',
                      boxShadow: 'var(--shadow-float)',
                      fontSize: 13,
                    }}
                  />
                  <Area type="monotone" dataKey="available" stroke="var(--color-accent)" fill="url(#avail)" strokeWidth={2.5} animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Checklist */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Account setup</CardTitle>
              <span className="text-sm font-semibold text-accent">
                {completed}/{checklist.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-elevated">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright"
                initial={{ width: 0 }}
                animate={{ width: `${(completed / checklist.length) * 100}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm">
                {item.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-accent" />
                ) : (
                  <Circle className="size-5 shrink-0 text-line-strong" />
                )}
                <span className={item.done ? 'text-ink-muted line-through decoration-line-strong' : 'font-medium'}>
                  {item.label}
                </span>
              </div>
            ))}
            {completed < checklist.length ? (
              <Button asChild className="mt-3 w-full">
                <Link to="/app/deposits">
                  Continue setup
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <p className="mt-3 rounded-lg bg-accent-soft p-3 text-center text-sm font-medium text-accent">
                You’re all set: account fully configured
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        {/* Activity */}
        <Card className="overflow-hidden">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Latest confirmed ledger entries.</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <SkeletonRows />
            ) : ledger.length === 0 ? (
              <div className="px-6 pb-6">
                <EmptyState
                  icon={Receipt}
                  title="No activity yet"
                  description="Deposits, withdrawals, and adjustments will appear here."
                  action={
                    <Button asChild size="sm">
                      <Link to="/app/deposits">Make your first deposit</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <Table>
                <THead>
                  <tr>
                    <TH>Transaction</TH>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH className="text-right">Amount</TH>
                  </tr>
                </THead>
                <TBody>
                  {ledger.slice(0, 8).map((entry) => {
                    const isOut = outgoing.has(entry.type)
                    return (
                      <TR key={entry.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <span className={cn('grid size-9 place-items-center rounded-xl', isOut ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent')}>
                              {isOut ? <ArrowUpRight className="size-4" /> : <ArrowDownLeft className="size-4" />}
                            </span>
                            <span className="font-medium capitalize">{entry.type.replaceAll('_', ' ')}</span>
                          </div>
                        </TD>
                        <TD className="text-ink-muted">{format(new Date(entry.createdAt), 'MMM d, yyyy, p')}</TD>
                        <TD>
                          <StatusBadge status={entry.status ?? 'completed'} />
                        </TD>
                        <TD className={cn('tabular text-right font-semibold', !isOut && 'text-accent')}>
                          {isOut ? '−' : '+'}
                          {formatMinor(Math.abs(entry.amountMinor), {
                            scale,
                            currency: entry.currency === 'USD' ? 'USD' : undefined,
                          })}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pending */}
        <Card>
          <CardHeader>
            <CardTitle>Pending requests</CardTitle>
            <CardDescription>Requests awaiting review or completion.</CardDescription>
          </CardHeader>
          <CardContent>
            {depositsQuery.isLoading || withdrawalsQuery.isLoading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton h-14 rounded-xl" />
                ))}
              </div>
            ) : pending.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line-strong bg-canvas p-6 text-center">
                <CheckCircle2 className="mx-auto size-7 text-accent" />
                <p className="mt-2 text-sm font-medium">Nothing pending</p>
                <p className="text-xs text-ink-muted">All your requests have been processed.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {pending.slice(0, 6).map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
                    <div className="flex items-center gap-3">
                      <span className={cn('grid size-9 place-items-center rounded-lg', item.kind === 'Deposit' ? 'bg-accent-soft text-accent' : 'bg-warning/10 text-warning')}>
                        {item.kind === 'Deposit' ? <ArrowDownToLine className="size-4" /> : <ArrowUpFromLine className="size-4" />}
                      </span>
                      <div>
                        <p className="tabular text-sm font-semibold">
                          {formatMinor(item.amountMinor, { scale, currency: item.currency === 'USD' ? 'USD' : undefined })}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {item.kind}, {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
