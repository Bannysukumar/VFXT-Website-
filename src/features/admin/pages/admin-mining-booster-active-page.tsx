import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { adminGetBoosterStats, adminListActiveUserBoosters } from '@/services/admin-service'

export function AdminMiningBoosterActivePage() {
  const stats = useQuery({ queryKey: ['admin', 'boosters', 'stats'], queryFn: adminGetBoosterStats })
  const active = useQuery({
    queryKey: ['admin', 'boosters', 'active'],
    queryFn: adminListActiveUserBoosters,
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet mining"
        title="Active boosters"
        description="Boosters currently adding speed to user mining. Count updates as payments confirm and boosts expire."
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters">Booster catalog</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters/history">Booster history</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-2xl">
            {stats.data?.activeBoosters ?? '—'}{' '}
            <span className="text-base font-normal text-ink-muted">currently active</span>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Live activations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {active.isLoading ? (
            <LoadingState />
          ) : active.isError ? (
            <ErrorState message={active.error.message} onRetry={() => active.refetch()} />
          ) : (active.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">No active boosters right now.</p>
          ) : (
            active.data!.items.map((row) => (
              <div
                key={row.userBoosterId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {row.boosterName}{' '}
                    <Badge variant="secondary">{row.status}</Badge>
                  </p>
                  <p className="text-ink-muted">+{row.bonusRatePerHour} VFXT/h</p>
                  <p className="font-mono text-xs text-ink-muted">{row.userId}</p>
                </div>
                <div className="text-right text-xs text-ink-muted">
                  <div>Started {new Date(row.activatedAtMillis).toLocaleString()}</div>
                  <div>Ends {new Date(row.expiresAtMillis).toLocaleString()}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
