import { useQuery } from '@tanstack/react-query'
import { collection, getDocs, limit, orderBy, query } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { getDb, isFirebaseReady } from '@/lib/firebase'

async function listReferrals() {
  if (!isFirebaseReady()) return []
  const q = query(collection(getDb(), 'referrals'), orderBy('createdAt', 'desc'), limit(50))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string
    referrerId?: string
    refereeId?: string
    status?: string
  }>
}

export function AdminAffiliatesPage() {
  const result = useQuery({ queryKey: ['admin', 'affiliates'], queryFn: listReferrals })

  if (result.isLoading) return <LoadingState />
  if (result.isError) {
    return <ErrorState message={result.error.message} onRetry={() => result.refetch()} />
  }

  const rows = result.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Affiliate graph</h1>
        <p className="text-ink-muted">Recent referral edges (server-written).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Referrals</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {rows.length === 0 ? (
            <p className="text-ink-muted">No referral links yet.</p>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="grid gap-1 border-b border-line py-2 last:border-0 sm:grid-cols-3">
                <span className="font-mono text-xs">Sponsor {r.referrerId}</span>
                <span className="font-mono text-xs">Member {r.refereeId}</span>
                <span className="text-ink-muted">{r.status ?? '—'}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
