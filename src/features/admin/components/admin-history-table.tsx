import { useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { SkeletonRows } from '@/components/shared/stat-card'
import { AdminFiltersBar } from '@/features/admin/components/admin-filters'
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
  searchPlaceholder?: string
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
  searchPlaceholder = 'Search user, tx, status…',
}: Props) {
  const [search, setSearch] = useState('')
  const query = useQuery({ queryKey, queryFn })
  const allRows = query.data?.rows ?? []

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allRows
    return allRows.filter((row) =>
      Object.values(row).some((v) => {
        if (v == null) return false
        if (typeof v === 'object') return JSON.stringify(v).toLowerCase().includes(term)
        return String(v).toLowerCase().includes(term)
      }),
    )
  }, [allRows, search])

  const totalMinor =
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
      <AdminFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder}
        onRefresh={() => void query.refetch()}
        refreshing={query.isFetching}
        resultCount={rows.length}
        exportDisabled={rows.length === 0}
        onExportCsv={() => exportRowsToCsv(exportBasename, exportCols, exportRows)}
        onExportExcel={() =>
          exportRowsToExcel(exportBasename, exportCols, exportRows, title.slice(0, 31))
        }
        extra={
          rows.length > 0 ? (
            <p className="text-sm text-ink-muted">
              Total{' '}
              <span className="tabular font-semibold text-ink">
                {amountCurrency === 'VFXT'
                  ? `${formatMinor(totalMinor, { scale: 0 })} VFXT`
                  : formatMinor(totalMinor, { scale: 2, currency: 'USD' })}
              </span>
            </p>
          ) : null
        }
      />

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
