import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { RANK_REWARDS } from '@/lib/plan'
import { formatMinor } from '@/lib/money'
import { getRankStatus } from '@/services/plan-service'

export function RanksPage() {
  const query = useQuery({ queryKey: ['ranks'], queryFn: getRankStatus })

  if (query.isLoading) return <LoadingState label="Loading rank status…" />
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  }

  const status = query.data!

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">Rank & salary</h1>
        <p className="mt-1 text-ink-muted">
          Matching left/right binary business volume unlocks recurring salary rewards. Volumes update
          when your downline stakes.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Current rank</CardDescription>
            <CardTitle className="font-sans text-3xl">{status.currentRank || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Left volume</CardDescription>
            <CardTitle className="font-sans text-3xl">
              {formatMinor(status.leftVolumeMinor, { scale: 2, currency: 'USD' })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Right volume</CardDescription>
            <CardTitle className="font-sans text-3xl">
              {formatMinor(status.rightVolumeMinor, { scale: 2, currency: 'USD' })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {status.nextRank ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Next: Rank {status.nextRank}</CardTitle>
            <CardDescription>
              Need {formatMinor(status.nextLeftNeedMinor, { scale: 2, currency: 'USD' })} more left and{' '}
              {formatMinor(status.nextRightNeedMinor, { scale: 2, currency: 'USD' })} more right.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Rank table</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-ink-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Rank</th>
                <th className="py-2 font-medium">Left</th>
                <th className="py-2 font-medium">Right</th>
                <th className="py-2 font-medium">Reward</th>
                <th className="py-2 font-medium">Cycle</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {RANK_REWARDS.map((r) => {
                const achieved = status.currentRank >= r.rank
                const leftOk = status.leftVolumeMinor >= r.leftUsd * 100
                const rightOk = status.rightVolumeMinor >= r.rightUsd * 100
                return (
                  <tr key={r.rank} className="border-b border-line last:border-0">
                    <td className="py-2 font-medium">{r.rank}</td>
                    <td className="py-2">${r.leftUsd.toLocaleString()}</td>
                    <td className="py-2">${r.rightUsd.toLocaleString()}</td>
                    <td className="py-2">${r.rewardUsd}</td>
                    <td className="py-2">{r.cycleDays} days</td>
                    <td className="py-2">
                      <Badge variant={achieved ? 'success' : leftOk && rightOk ? 'warning' : 'secondary'}>
                        {achieved ? 'Qualified' : leftOk && rightOk ? 'Eligible' : 'In progress'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
