import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Receipt } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusBadge } from '@/components/shared/status-badge'
import { BscTxLink } from '@/components/shared/bsc-tx-link'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor } from '@/lib/money'
import { WALLET_META, type WalletKind } from '@/lib/plan'
import { cn } from '@/lib/utils'
import { fetchUserLedger, fetchUserWallets, walletDocId } from '@/services/wallet-service'
import { fetchMyWithdrawals } from '@/services/records-service'

function txHashFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const tx = (metadata as Record<string, unknown>).txHash
  return typeof tx === 'string' && tx.trim() ? tx.trim() : null
}

const OUTGOING_TYPES = new Set([
  'withdrawal_debit',
  'withdrawal_reserve',
  'transfer_out',
  'fee',
  'stake',
])

function isOutgoing(entry: {
  type: string
  direction?: string
}): boolean {
  if (entry.direction === 'debit') return true
  if (entry.direction === 'credit') return false
  return OUTGOING_TYPES.has(entry.type)
}

function formatAmount(amountMinor: number, currency: 'USD' | 'VFXT', scale: number) {
  if (currency === 'VFXT') {
    return `${formatMinor(amountMinor, { scale: 0 })} VFXT`
  }
  return formatMinor(amountMinor, { scale, currency: 'USD' })
}

export function WalletHistoryPage() {
  const { kind: kindParam } = useParams<{ kind: string }>()
  const kind = kindParam as WalletKind | undefined
  const meta = kind && kind in WALLET_META ? WALLET_META[kind] : null
  const { user } = useAuth()
  const userId = user?.uid ?? ''
  const walletId = userId && kind ? walletDocId(userId, kind) : ''

  const walletsQuery = useQuery({
    queryKey: ['wallets', userId],
    queryFn: () => fetchUserWallets(userId),
    enabled: Boolean(userId && meta),
  })

  const ledgerQuery = useQuery({
    queryKey: ['ledger', userId, walletId],
    queryFn: () => fetchUserLedger(userId, 200, { walletId }),
    enabled: Boolean(userId && walletId && meta),
  })

  const withdrawalsQuery = useQuery({
    queryKey: ['my-withdrawals', userId],
    queryFn: () => fetchMyWithdrawals(userId, 50),
    enabled: Boolean(userId && kind === 'withdrawal'),
  })

  const wallet = useMemo(
    () => (walletsQuery.data ?? []).find((w) => w.id === walletId || w.kind === kind),
    [walletsQuery.data, walletId, kind],
  )

  if (!meta || !kind) {
    return (
      <div className="space-y-4">
        <ErrorState message={`Unknown wallet: ${kindParam ?? ''}`} />
        <Button asChild variant="secondary">
          <Link to="/app/wallets">Back to wallets</Link>
        </Button>
      </div>
    )
  }

  if (ledgerQuery.isLoading || walletsQuery.isLoading) return <LoadingState />
  if (ledgerQuery.isError) {
    return (
      <ErrorState
        message={ledgerQuery.error.message}
        onRetry={() => ledgerQuery.refetch()}
      />
    )
  }

  const rows = ledgerQuery.data ?? []
  const scale = wallet?.scale ?? (meta.currency === 'VFXT' ? 0 : 2)
  const withdrawalRows = withdrawalsQuery.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/app/wallets" className="no-underline">
              <ArrowLeft className="size-3.5" />
              All wallets
            </Link>
          </Button>
          <h1 className="text-4xl">{meta.label} history</h1>
          <p className="text-ink-muted">{meta.description}</p>
        </div>
        <div className="rounded-2xl border border-line bg-panel px-4 py-3 text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Available</p>
          <p className="tabular font-display text-2xl font-bold text-ink">
            {wallet
              ? formatAmount(wallet.availableMinor, meta.currency, scale)
              : '—'}
          </p>
        </div>
      </div>

      {kind === 'withdrawal' ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="font-sans text-lg">On-chain withdrawals</CardTitle>
            <CardDescription>
              Successful sends include a BscScan link for the transaction hash.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {withdrawalsQuery.isLoading ? (
              <div className="p-6 text-sm text-ink-muted">Loading withdrawals…</div>
            ) : withdrawalRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Receipt}
                  title="No withdrawals yet"
                  description="Completed USDT sends will appear here with BscScan links."
                  action={
                    <Button asChild size="sm">
                      <Link to="/app/withdrawals">Withdraw</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <TH>When</TH>
                      <TH>Destination</TH>
                      <TH>Status</TH>
                      <TH>Tx hash</TH>
                      <TH className="text-right">Amount</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {withdrawalRows.map((w) => (
                      <TR key={w.id}>
                        <TD className="whitespace-nowrap text-ink-muted">
                          {format(new Date(w.createdAt), 'MMM d, yyyy · p')}
                        </TD>
                        <TD className="max-w-[140px] truncate font-mono text-xs">
                          {w.destination || '—'}
                        </TD>
                        <TD>
                          <StatusBadge status={w.status} />
                        </TD>
                        <TD>
                          <BscTxLink txHash={w.txHash} compact />
                        </TD>
                        <TD className="tabular text-right font-semibold">
                          {formatMinor(w.amountMinor, { scale: 2, currency: 'USD' })}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Transaction history</CardTitle>
          <CardDescription>
            {rows.length} entr{rows.length === 1 ? 'y' : 'ies'} for this wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState
                icon={Receipt}
                title="No history yet"
                description="Credits and debits for this wallet will appear here."
                action={
                  kind === 'fund' ? (
                    <Button asChild size="sm">
                      <Link to="/app/deposits">Make a deposit</Link>
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>Transaction</TH>
                    <TH>Date</TH>
                    <TH>Status</TH>
                    <TH>Tx hash</TH>
                    <TH className="text-right">Amount</TH>
                    <TH className="text-right">Balance after</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((entry) => {
                    const out = isOutgoing(entry)
                    const txHash = txHashFromMetadata(entry.metadata)
                    return (
                      <TR key={entry.id}>
                        <TD>
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'grid size-9 place-items-center rounded-xl',
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
                              <p className="font-medium capitalize">
                                {String(entry.type).replaceAll('_', ' ')}
                              </p>
                              {entry.description ? (
                                <p className="truncate text-xs text-ink-muted">
                                  {entry.description}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap text-ink-muted">
                          {format(new Date(entry.createdAt), 'MMM d, yyyy · p')}
                        </TD>
                        <TD>
                          <StatusBadge
                            status={
                              entry.status ??
                              (entry.direction === 'debit' ? 'completed' : 'completed')
                            }
                          />
                        </TD>
                        <TD>
                          <BscTxLink txHash={txHash} compact />
                        </TD>
                        <TD
                          className={cn(
                            'tabular text-right font-semibold',
                            !out && 'text-accent',
                          )}
                        >
                          {out ? '−' : '+'}
                          {formatAmount(Math.abs(entry.amountMinor), meta.currency, scale)}
                        </TD>
                        <TD className="tabular text-right text-ink-muted">
                          {formatAmount(entry.balanceAfterAvailableMinor, meta.currency, scale)}
                        </TD>
                      </TR>
                    )
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
