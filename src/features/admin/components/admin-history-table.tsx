import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { SkeletonRows } from '@/components/shared/stat-card'
import {
  exportRowsToCsv,
  exportRowsToExcel,
  type ExportColumn,
} from '@/lib/export-table'
import { formatMinor } from '@/lib/money'

export type HistoryColumn = ExportColumn & {
  /** Render helper; defaults to string value */
  render?: (row: Record<string, unknown>) => ReactNode
  align?: 'left' | 'right'
}

type Props = {
  title: string
  description: string
  eyebrow?: string
  queryKey: unknown[]
  queryFn: () => Promise<{ rows: Array<Record<string, unknown>>; totalMinor?: number }>
  columns: HistoryColumn[]
  emptyTitle: string
  exportBasename: string
  amountField?: string
  amountCurrency?: 'USD' | 'VFXT'
}

export function AdminHistoryTable({
  title,
  description,
  eyebrow = 'Finance',
  queryKey,
  queryFn,
  columns,
  emptyTitle,
  exportBasename,
  amountField = 'amountMinor',
  amountCurrency = 'USD',
}: Props) {
  const query = useQuery({ queryKey, queryFn })
  const rows = query.data?.rows ?? []
  const totalMinor =
    query.data?.totalMinor ??
    rows.reduce((s, r) => s + Number(r[amountField] ?? 0), 0)

  const exportRows = useMemo(
    () =>
      rows.map((r) => {
        const out: Record<string, unknown> = { ...r }
        if (typeof out.metadata === 'object') {
          out.metadata = JSON.stringify(out.metadata)
        }
        return out
      }),
    [rows],
  )

  const exportCols: ExportColumn[] = columns.map(({ key, label }) => ({ key, label }))

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">
          {rows.length} row{rows.length === 1 ? '' : 's'}
          {rows.length > 0 ? (
            <>
              {' '}
              · Total{' '}
              <span className="tabular font-semibold text-ink">
                {amountCurrency === 'VFXT'
                  ? `${formatMinor(totalMinor, { scale: 0 })} VFXT`
                  : formatMinor(totalMinor, { scale: 2, currency: 'USD' })}
              </span>
            </>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length === 0}
            onClick={() => exportRowsToCsv(exportBasename, exportCols, exportRows)}
          >
            <Download className="size-3.5" />
            Export CSV
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={rows.length === 0}
            onClick={() =>
              exportRowsToExcel(exportBasename, exportCols, exportRows, title.slice(0, 31))
            }
          >
            <FileSpreadsheet className="size-3.5" />
            Export Excel
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Refresh
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {query.isLoading ? (
            <SkeletonRows rows={6} />
          ) : query.isError ? (
            <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState title={emptyTitle} description="Matching records will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    {columns.map((c) => (
                      <TH key={c.key} className={c.align === 'right' ? 'text-right' : undefined}>
                        {c.label}
                      </TH>
                    ))}
                  </tr>
                </THead>
                <TBody>
                  {rows.map((row) => (
                    <TR key={String(row.id ?? row.entryId ?? JSON.stringify(row))}>
                      {columns.map((c) => (
                        <TD
                          key={c.key}
                          className={c.align === 'right' ? 'text-right tabular' : undefined}
                        >
                          {c.render
                            ? c.render(row)
                            : String(row[c.key] ?? '—')}
                        </TD>
                      ))}
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
