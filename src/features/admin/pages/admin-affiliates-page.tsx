import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { collection, documentId, getDocs, limit, orderBy, query, where } from 'firebase/firestore'
import { format } from 'date-fns'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { AdminFiltersBar } from '@/features/admin/components/admin-filters'
import { StatusPill, UserCell } from '@/features/admin/components/admin-ui'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import { exportRowsToCsv, exportRowsToExcel } from '@/lib/export-table'
import { Users } from 'lucide-react'

type ReferralRow = {
  id: string
  referrerId: string
  refereeId: string
  status: string
  createdAt: string
  referrerEmail: string | null
  referrerName: string | null
  refereeEmail: string | null
  refereeName: string | null
}

async function loadUserMap(uids: string[]) {
  const unique = [...new Set(uids.filter(Boolean))]
  const map = new Map<string, { email: string | null; displayName: string | null }>()
  if (!unique.length || !isFirebaseReady()) return map
  const db = getDb()
  for (let i = 0; i < unique.length; i += 30) {
    const chunk = unique.slice(i, i + 30)
    const q = query(collection(db, 'users'), where(documentId(), 'in', chunk))
    const snap = await getDocs(q)
    for (const d of snap.docs) {
      const data = d.data()
      map.set(d.id, {
        email: typeof data.email === 'string' ? data.email : null,
        displayName: typeof data.displayName === 'string' ? data.displayName : null,
      })
    }
  }
  return map
}

async function listReferrals(): Promise<ReferralRow[]> {
  if (!isFirebaseReady()) return []
  const q = query(collection(getDb(), 'referrals'), orderBy('createdAt', 'desc'), limit(200))
  const snap = await getDocs(q)
  const base = snap.docs.map((d) => {
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
  const users = await loadUserMap(base.flatMap((r) => [r.referrerId, r.refereeId]))
  return base.map((r) => {
    const sponsor = users.get(r.referrerId)
    const member = users.get(r.refereeId)
    return {
      ...r,
      referrerEmail: sponsor?.email ?? null,
      referrerName: sponsor?.displayName ?? null,
      refereeEmail: member?.email ?? null,
      refereeName: member?.displayName ?? null,
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
      [
        r.id,
        r.referrerId,
        r.refereeId,
        r.status,
        r.referrerEmail,
        r.referrerName,
        r.refereeEmail,
        r.refereeName,
      ].some((v) => String(v ?? '').toLowerCase().includes(term)),
    )
  }, [allRows, search])

  const exportCols = [
    { key: 'referrerName', label: 'Sponsor name' },
    { key: 'referrerEmail', label: 'Sponsor email' },
    { key: 'referrerId', label: 'Sponsor ID' },
    { key: 'refereeName', label: 'Member name' },
    { key: 'refereeEmail', label: 'Member email' },
    { key: 'refereeId', label: 'Member ID' },
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
        description="Who referred whom — names and emails when available."
      />
      <AdminFiltersBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search name, email, status…"
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
                    <TH>Joined</TH>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((r) => (
                    <TR key={r.id}>
                      <TD>
                        <UserCell
                          userId={r.referrerId}
                          email={r.referrerEmail}
                          displayName={r.referrerName}
                        />
                      </TD>
                      <TD>
                        <UserCell
                          userId={r.refereeId}
                          email={r.refereeEmail}
                          displayName={r.refereeName}
                        />
                      </TD>
                      <TD>
                        <StatusPill status={r.status} />
                      </TD>
                      <TD className="whitespace-nowrap text-sm text-ink-muted">
                        {r.createdAt ? format(new Date(r.createdAt), 'dd MMM yyyy HH:mm') : '—'}
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
