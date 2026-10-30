import { format } from 'date-fns'
import { ArrowDownToLine, ArrowUpFromLine, History } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/status-badge'
import { SkeletonRows } from '@/components/shared/stat-card'
import { BscTxLink } from '@/components/shared/bsc-tx-link'
import { formatMinor } from '@/lib/money'
import type { DepositRequest, WithdrawalRequest } from '@/types/models'

type Row = (DepositRequest | WithdrawalRequest) & {
  destination?: string
  txHash?: string | null
  providerRef?: string
}

export function RequestHistory({
  title,
  description,
  rows,
  loading,
  error,
  kind,
}: {
  title: string
  description: string
  rows: Row[]
  loading: boolean
  error?: string
  kind: 'deposit' | 'withdrawal'
}) {
  const Icon = kind === 'deposit' ? ArrowDownToLine : ArrowUpFromLine
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <SkeletonRows rows={3} />
        ) : error ? (
          <p className="px-6 pb-6 text-sm text-danger">{error}</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 pb-10 pt-4 text-center">
            <span className="grid size-12 place-items-center rounded-xl bg-panel-elevated text-ink-subtle">
              <History className="size-5" />
            </span>
            <p className="text-sm font-medium">No requests yet</p>
            <p className="text-xs text-ink-muted">Your submitted requests will be listed here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Request</TH>
                  <TH>{kind === 'deposit' ? 'Note' : 'Destination'}</TH>
                  <TH>Status</TH>
                  {kind === 'withdrawal' ? <TH>Tx hash</TH> : null}
                  <TH className="text-right">Amount</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-panel-elevated text-ink-muted">
                          <Icon className="size-4" />
                        </span>
                        <div>
                          <p className="font-medium">{format(new Date(row.createdAt), 'MMM d, yyyy')}</p>
                          <p className="font-mono text-[11px] text-ink-subtle">{row.id.slice(0, 12)}</p>
                        </div>
                      </div>
                    </TD>
                    <TD className="max-w-56 truncate text-ink-muted">
                      {(kind === 'withdrawal' ? row.destination : row.note) || '—'}
                    </TD>
                    <TD>
                      <StatusBadge status={row.status} />
                    </TD>
                    {kind === 'withdrawal' ? (
                      <TD>
                        <BscTxLink txHash={row.txHash} compact />
                      </TD>
                    ) : null}
                    <TD className="tabular text-right font-semibold">
                      {formatMinor(row.amountMinor, {
                        scale: 2,
                        currency: row.currency === 'USD' ? 'USD' : undefined,
                      })}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
