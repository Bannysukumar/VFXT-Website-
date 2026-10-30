import type { ReactNode } from 'react'
import { Download, FileSpreadsheet, Loader2, RefreshCw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type FilterSelect = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
}

type Props = {
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder?: string
  selects?: FilterSelect[]
  onRefresh?: () => void
  refreshing?: boolean
  onExportCsv?: () => void
  onExportExcel?: () => void
  exportDisabled?: boolean
  resultCount?: number
  extra?: ReactNode
  className?: string
}

export function AdminFiltersBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search…',
  selects = [],
  onRefresh,
  refreshing,
  onExportCsv,
  onExportExcel,
  exportDisabled,
  resultCount,
  extra,
  className,
}: Props) {
  const hasFilters = search.trim() !== '' || selects.some((s) => s.value !== '')

  return (
    <div className={cn('space-y-3 rounded-2xl border border-line bg-panel p-4', className)}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Label htmlFor="admin-filter-search" className="sr-only">
            Search
          </Label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            id="admin-filter-search"
            className="pl-10"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        {selects.map((s) => (
          <div key={s.id} className="min-w-[140px] space-y-1.5">
            <Label htmlFor={s.id} className="text-xs text-ink-muted">
              {s.label}
            </Label>
            <NativeSelect id={s.id} value={s.value} onChange={(e) => s.onChange(e.target.value)}>
              {s.options.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </NativeSelect>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onSearchChange('')
                selects.forEach((s) => s.onChange(''))
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          ) : null}
          {onRefresh ? (
            <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Refresh
            </Button>
          ) : null}
          {onExportCsv ? (
            <Button type="button" variant="outline" size="sm" disabled={exportDisabled} onClick={onExportCsv}>
              <Download className="size-3.5" />
              CSV
            </Button>
          ) : null}
          {onExportExcel ? (
            <Button type="button" variant="secondary" size="sm" disabled={exportDisabled} onClick={onExportExcel}>
              <FileSpreadsheet className="size-3.5" />
              Excel
            </Button>
          ) : null}
          {extra}
        </div>
      </div>
      {typeof resultCount === 'number' ? (
        <p className="text-xs text-ink-muted">
          Showing <span className="font-semibold text-ink">{resultCount}</span> result
          {resultCount === 1 ? '' : 's'}
        </p>
      ) : null}
    </div>
  )
}
