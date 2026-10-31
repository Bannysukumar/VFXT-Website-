import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Send } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
            <Link to="/app/transfer">
              <ArrowLeft className="size-4" />
              Back to transfer
            </Link>
          </Button>
          <h1 className="text-4xl">Transfer history</h1>
          <p className="text-ink-muted">Member-to-member sends and receives by User ID.</p>
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
          <CardTitle className="font-sans text-lg">All peer transfers</CardTitle>
          <CardDescription>{rows.length} record{rows.length === 1 ? '' : 's'}</CardDescription>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState
              title="No transfers yet"
              description="When you send or receive by User ID, it will show here."
            />
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>When</TH>
                  <TH>Direction</TH>
                  <TH>Counterparty</TH>
                  <TH>Wallet</TH>
                  <TH className="text-right">Amount</TH>
                  <TH>Note</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((entry) => {
                  const out = entry.direction === 'debit'
                  const counterparty =
                    metaString(entry.metadata, 'counterpartyUserId') ||
                    metaString(entry.metadata, out ? 'toUserId' : 'fromUserId') ||
                    '—'
                  const note = metaString(entry.metadata, 'note')
                  const walletKind = metaString(entry.metadata, 'walletKind') || '—'
                  const currency = entry.currency === 'VFXT' ? 'VFXT' : 'USD'
                  const scale = currency === 'VFXT' ? 0 : 2
                  return (
                    <TR key={entry.id}>
                      <TD className="whitespace-nowrap text-sm text-ink-muted">
                        {entry.createdAt
                          ? format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm')
                          : '—'}
                      </TD>
                      <TD>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 text-sm font-medium',
                            out ? 'text-danger' : 'text-accent',
                          )}
                        >
                          {out ? (
                            <ArrowUpRight className="size-4" />
                          ) : (
                            <ArrowDownLeft className="size-4" />
                          )}
                          {out ? 'Sent' : 'Received'}
                        </span>
                      </TD>
                      <TD className="font-mono text-sm">{counterparty}</TD>
                      <TD className="capitalize text-sm">{walletKind.replaceAll('_', ' ')}</TD>
                      <TD className="text-right tabular font-medium">
                        {out ? '−' : '+'}
                        {currency === 'VFXT'
                          ? `${formatMinor(entry.amountMinor, { scale: 0 })} VFXT`
                          : formatMinor(entry.amountMinor, { scale, currency: 'USD' })}
                      </TD>
                      <TD className="max-w-[12rem] truncate text-sm text-ink-muted">
                        {note || '—'}
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
