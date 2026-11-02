import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  CheckCircle2,
  Crown,
  Eye,
  KeyRound,
  LifeBuoy,
  ScrollText,
  Settings2,
  Ticket,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { StatCard, StatCardSkeleton } from '@/components/shared/stat-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor } from '@/lib/money'
import { TypeText } from '@/components/motion/typing'
import { images } from '@/lib/media'
import { bootstrapFirstAdmin, getPlatformStats } from '@/services/admin-service'
import { fetchAuditLogs, fetchDepositsByStatus, fetchWithdrawalsByStatus } from '@/services/records-service'

const roles: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Crown, title: 'Super Admin', body: 'Full control including role assignment' },
  { icon: Wallet, title: 'Finance Admin', body: 'Deposits, withdrawals, ledger adjustments' },
  { icon: Settings2, title: 'Operations Admin', body: 'Platform configuration and feature flags' },
  { icon: LifeBuoy, title: 'Support Admin', body: 'Tickets and user assistance' },
  { icon: Eye, title: 'Read-Only Admin', body: 'Observability without mutations' },
]

function QueuePreview({
  title,
  to,
  icon: Icon,
  loading,
  error,
  rows,
}: {
  title: string
  to: string
  icon: LucideIcon
  loading: boolean
  error?: string
  rows: { id: string; amountMinor: number; currency: string; status: string; createdAt: string }[]
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
            <Icon className="size-5" />
          </span>
          <CardTitle>{title}</CardTitle>
        </div>
        <Button asChild variant="ghost" size="sm">
          <Link to={to}>
            View all
            <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-accent-soft/60 p-4 text-sm font-medium text-accent">
            <CheckCircle2 className="size-5" />
            Queue is clear
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="tabular font-semibold">
                    {row.currency === 'VFXT'
                      ? `${formatMinor(row.amountMinor, { scale: 0 })} VFXT`
                      : formatMinor(row.amountMinor, {
                          scale: 2,
                          currency: row.currency === 'USD' ? 'USD' : undefined,
                        })}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {formatDistanceToNow(new Date(row.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function AdminDashboardPage() {
  const { adminRole, user } = useAuth()
  const [secret, setSecret] = useState('')

  const stats = useQuery({ queryKey: ['admin', 'stats'], queryFn: getPlatformStats, retry: false })
  const deposits = useQuery({ queryKey: ['admin', 'deposits', 'preview'], queryFn: () => fetchDepositsByStatus('pending', 5) })
  const withdrawals = useQuery({ queryKey: ['admin', 'withdrawals', 'preview'], queryFn: () => fetchWithdrawalsByStatus('pending', 5) })
  const audit = useQuery({ queryKey: ['admin', 'audit', 'preview'], queryFn: () => fetchAuditLogs(6), retry: false })

  const bootstrap = useMutation({
    mutationFn: () => bootstrapFirstAdmin(secret),
    onSuccess: () => toast.success('Bootstrap complete — refresh session'),
    onError: (e: Error) => toast.error(e.message),
  })

  const statCards = [
    { label: 'Total users', value: stats.data?.userCount, icon: Users, tone: 'info' as const, to: '/admin/users' },
    { label: 'Pending deposits', value: stats.data?.pendingDeposits, icon: ArrowDownToLine, tone: 'accent' as const, to: '/admin/deposits' },
    { label: 'In-flight withdrawals', value: stats.data?.pendingWithdrawals, icon: ArrowUpFromLine, tone: 'warning' as const, to: '/admin/withdrawals' },
    { label: 'Open tickets', value: stats.data?.openTickets, icon: Ticket, tone: 'danger' as const, to: '/admin/tickets' },
  ]

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative isolate overflow-hidden rounded-3xl bg-brand p-8 text-white shadow-lift"
      >
        <img src={images.skyscrapers} alt="" className="absolute inset-0 -z-10 size-full object-cover opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-brand via-brand/90 to-brand/40" />
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semiboldr text-highlight">Admin console</p>
            <h1 className="mt-2 text-3xl font-bold text-white">
              <TypeText text={`Welcome back${user?.displayName ? `, ${user.displayName.split(' ')[0]}` : ''}`} speed={45} delay={250} />
            </h1>
            <p className="mt-2 max-w-lg text-white/70">
              Privileged actions execute only in Cloud Functions and every one is written to the audit log.
            </p>
          </div>
          <Badge className="h-9 border-white/15 bg-white/10 px-4 text-sm capitalize text-white backdrop-blur">
            <Crown className="size-4 text-highlight" />
            {adminRole?.replaceAll('_', ' ') ?? 'unknown role'}
          </Badge>
        </div>
      </motion.section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.isLoading
          ? Array.from({ length: 4 }, (_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card, i) => (
              <Link key={card.label} to={card.to} className="block">
                <StatCard
                  index={i}
                  label={card.label}
                  icon={card.icon}
                  tone={card.tone}
                  value={stats.isError ? '—' : (card.value ?? 0)}
                  footer={
                    <span className="flex items-center gap-1 text-xs font-semibold text-accent">
                      Open queue <ArrowRight className="size-3.5" />
                    </span>
                  }
                />
              </Link>
            ))}
      </div>
      {stats.isError ? (
        <p className="text-sm text-danger">Stats unavailable: {stats.error.message}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <QueuePreview
          title="Pending deposits"
          to="/admin/deposits"
          icon={ArrowDownToLine}
          loading={deposits.isLoading}
          error={deposits.isError ? deposits.error.message : undefined}
          rows={deposits.data ?? []}
        />
        <QueuePreview
          title="Pending withdrawals"
          to="/admin/withdrawals"
          icon={ArrowUpFromLine}
          loading={withdrawals.isLoading}
          error={withdrawals.isError ? withdrawals.error.message : undefined}
          rows={withdrawals.data ?? []}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recent audit activity</CardTitle>
              <CardDescription>Latest privileged actions.</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin/audit">
                <ScrollText />
                Full log
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {audit.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton h-10 rounded-lg" />
                ))}
              </div>
            ) : audit.isError ? (
              <p className="text-sm text-ink-muted">Audit log requires a privileged admin role.</p>
            ) : (audit.data ?? []).length === 0 ? (
              <p className="text-sm text-ink-muted">No privileged actions recorded yet.</p>
            ) : (
              <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
                {audit.data!.map((entry) => (
                  <li key={entry.id} className="relative flex items-start gap-4 pl-6">
                    <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-panel bg-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs font-semibold">{entry.action}</p>
                      <p className="truncate text-xs capitalize text-ink-muted">
                        {entry.resourceType.replaceAll('_', ' ')}, {entry.resourceId}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-subtle">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role model</CardTitle>
            <CardDescription>Permissions are enforced server-side for each role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {roles.map(({ icon: Icon, title, body }) => {
              const active = adminRole && title.toLowerCase().startsWith(adminRole.split('_')[0]!)
              return (
                <div key={title} className={active ? 'flex items-center gap-3 rounded-xl bg-accent-soft p-2.5' : 'flex items-center gap-3 rounded-xl p-2.5'}>
                  <span className={active ? 'grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-white' : 'grid size-9 shrink-0 place-items-center rounded-lg bg-panel-elevated text-ink-muted'}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">
                      {title}
                      {active ? <span className="ml-2 text-xs font-medium text-accent">You</span> : null}
                    </p>
                    <p className="truncate text-xs text-ink-muted">{body}</p>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <Card className="border-dashed">
        <CardHeader className="flex-row items-start gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
            <KeyRound className="size-5" />
          </span>
          <div>
            <CardTitle>Bootstrap first administrator</CardTitle>
            <CardDescription className="mt-1">
              Uses a server secret (<code className="font-mono text-xs">BOOTSTRAP_SECRET</code>). Only succeeds when no
              admins exist. Never expose this secret in the frontend permanently — use a one-time ops runbook.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input type="password" placeholder="Bootstrap secret" value={secret} onChange={(e) => setSecret(e.target.value)} className="sm:max-w-sm" />
          <Button className="h-11" onClick={() => bootstrap.mutate()} disabled={!secret || bootstrap.isPending}>
            Bootstrap
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
