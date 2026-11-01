import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Send } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { fetchUserLedger } from '@/services/wallet-service'

function metaString(metadata: unknown, key: string): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const v = (metadata as Record<string, unknown>)[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function PeerTransferHistoryPage() {
  const { user } = useAuth()
  const userId = user?.uid ?? ''

  const ledgerQuery = useQuery({
    queryKey: ['ledger', userId, 'peer_transfer'],
    queryFn: () => fetchUserLedger(userId, 200),
    enabled: Boolean(userId),
  })

  const rows = useMemo(
    () => (ledgerQuery.data ?? []).filter((e) => e.type === 'peer_transfer'),
    [ledgerQuery.data],
  )

  if (ledgerQuery.isLoading) return <LoadingState label="Loading transfer history…" />
  if (ledgerQuery.isError) {
    return (
      <ErrorState message={ledgerQuery.error.message} onRetry={() => ledgerQuery.refetch()} />
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 mb-2" asChild>
            <Link to="/app/transfer">
              <ArrowLeft className="size-4" />
              Back to transfer
            </Link>
          </Button>
          <PageHeader
            title="Transfer history"
            description="Money you sent to other members, and money they sent to you."
          />
        </div>
        <Button asChild>
          <Link to="/app/transfer">
            <Send className="size-4" />
            New transfer
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All member transfers</CardTitle>
          <CardDescription>
            {rows.length} record{rows.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="No transfers yet"
              description="When you send or receive by User ID, it will show here."
              action={
                <Button asChild size="sm">
                  <Link to="/app/transfer">Send to someone</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-3">
              {rows.map((entry) => {
                const out = entry.direction === 'debit'
                const counterparty =
                  metaString(entry.metadata, 'counterpartyUserId') ||
                  metaString(entry.metadata, out ? 'toUserId' : 'fromUserId') ||
                  '—'
                const note = metaString(entry.metadata, 'note')
                const walletKind = metaString(entry.metadata, 'walletKind') || '—'
                const currency = entry.currency === 'VFXT' ? 'VFXT' : 'USD'
                const amount =
                  currency === 'VFXT'
                    ? `${formatMinor(entry.amountMinor, { scale: 0 })} VFXT`
                    : formatMinor(entry.amountMinor, { scale: 2, currency: 'USD' })

                return (
                  <li
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        className={cn(
                          'grid size-10 shrink-0 place-items-center rounded-xl',
                          out ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent',
                        )}
                      >
                        {out ? (
                          <ArrowUpRight className="size-4" />
                        ) : (
                          <ArrowDownLeft className="size-4" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold">
                          {out ? 'Sent to' : 'Received from'}{' '}
                          <span className="font-mono">{counterparty}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {entry.createdAt
                            ? format(new Date(entry.createdAt), 'dd MMM yyyy · HH:mm')
                            : '—'}
                          {' · '}
                          <span className="capitalize">{walletKind.replaceAll('_', ' ')}</span>
                          {note ? ` · ${note}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'tabular font-semibold',
                          out ? 'text-danger' : 'text-accent',
                        )}
                      >
                        {out ? '−' : '+'}
                        {amount}
                      </p>
                      <Badge variant="secondary" className="mt-1">
                        {out ? 'Sent' : 'Received'}
                      </Badge>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
