import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { AdminFiltersBar } from '@/features/admin/components/admin-filters'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import { exportRowsToCsv, exportRowsToExcel } from '@/lib/export-table'
import { Users } from 'lucide-react'

async function listReferrals() {
  if (!isFirebaseReady()) return []
  const q = query(collection(getDb(), 'referrals'), orderBy('createdAt', 'desc'), limit(200))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      referrerId: String(data.referrerId ?? ''),
      refereeId: String(data.refereeId ?? ''),
      status: String(data.status ?? ''),
      createdAt:
        typeof data.createdAt?.toDate === 'function'
          ? data.createdAt.toDate().toISOString()
          : String(data.createdAt ?? ''),
    }
  })
}

export function AdminAffiliatesPage() {
  const [search, setSearch] = useState('')
  const result = useQuery({ queryKey: ['admin', 'affiliates'], queryFn: listReferrals })

  const allRows = result.data ?? []
  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return allRows
    return allRows.filter((r) =>
      [r.id, r.referrerId, r.refereeId, r.status].some((v) => v.toLowerCase().includes(term)),
    )
  }, [allRows, search])

  const exportCols = [
    { key: 'id', label: 'ID' },
    { key: 'referrerId', label: 'Sponsor' },
    { key: 'refereeId', label: 'Member' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Created' },
  ]

  if (result.isLoading) return <LoadingState />
  if (result.isError) {
    return <ErrorState message={result.error.message} onRetry={() => result.refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Members"
        title="Affiliates"
        description="Referral edges written by the server when members join with a code."
      />
      <AdminFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search sponsor, member, status…"
        onRefresh={() => void result.refetch()}
        refreshing={result.isFetching}
        resultCount={rows.length}
        exportDisabled={rows.length === 0}
        onExportCsv={() =>
          exportRowsToCsv(
            `vfxt-affiliates-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            rows,
          )
        }
        onExportExcel={() =>
          exportRowsToExcel(
            `vfxt-affiliates-${new Date().toISOString().slice(0, 10)}`,
            exportCols,
            rows,
            'Affiliates',
          )
        }
      />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={Users} title="No referrals found" description="Affiliate links will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <tr>
                    <TH>Sponsor</TH>
                    <TH>Member</TH>
                    <TH>Status</TH>
                    <TH>Created</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-mono text-xs">{r.referrerId || '—'}</TD>
                      <TD className="font-mono text-xs">{r.refereeId || '—'}</TD>
                      <TD className="capitalize text-ink-muted">{r.status || '—'}</TD>
                      <TD className="whitespace-nowrap text-ink-muted">
                        {r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}
                      </TD>
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
