import { useQuery } from '@tanstack/react-query'
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import { formatMinor } from '@/lib/money'

async function listPositions() {
  if (!isFirebaseReady()) return []
  const q = query(
    collection(getDb(), 'stakingPositions'),
    orderBy('createdAt', 'desc'),
    limit(50),
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
    id: string
    userId?: string
    planId?: string
    principalMinor?: number
    status?: string
    totalPaidMinor?: number
  }>
}

export function AdminStakingPage() {
  const queryResult = useQuery({ queryKey: ['admin', 'staking'], queryFn: listPositions })

  if (queryResult.isLoading) return <LoadingState />
  if (queryResult.isError) {
    return (
      <ErrorState message={queryResult.error.message} onRetry={() => queryResult.refetch()} />
    )
  }

  const rows = queryResult.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl">Staking oversight</h1>
        <p className="text-ink-muted">Latest positions across the platform (admin read).</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Recent positions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rows.length === 0 ? (
            <p className="text-sm text-ink-muted">No staking positions yet.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">{row.planId?.replaceAll('_', ' ') ?? '—'}</p>
                  <p className="font-mono text-xs text-ink-muted">{row.userId}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{row.status ?? '—'}</Badge>
                  <span>
                    {formatMinor(row.principalMinor ?? 0, { scale: 2, currency: 'USD' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
