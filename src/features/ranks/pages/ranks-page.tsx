import { useQuery } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { RANK_REWARDS } from '@/lib/plan'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { getRankStatus } from '@/services/plan-service'

export function RanksPage() {
  const query = useQuery({ queryKey: ['ranks'], queryFn: getRankStatus })

  if (query.isLoading) return <LoadingState label="Loading rank status…" />
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  }

  const status = query.data!
  const next = RANK_REWARDS.find((r) => r.rank === status.nextRank)
  const leftNeed = status.nextLeftNeedMinor
  const rightNeed = status.nextRightNeedMinor
  const leftTarget = next ? next.leftUsd * 100 : 0
  const rightTarget = next ? next.rightUsd * 100 : 0
  const leftHave = Math.max(0, leftTarget - leftNeed)
  const rightHave = Math.max(0, rightTarget - rightNeed)
  const leftPct = leftTarget > 0 ? Math.min(100, Math.round((leftHave / leftTarget) * 100)) : 0
  const rightPct = rightTarget > 0 ? Math.min(100, Math.round((rightHave / rightTarget) * 100)) : 0

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Ranks & salary"
        description="Grow matching left and right team volume when your downline stakes. Higher ranks unlock recurring salary rewards."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Your rank</CardDescription>
            <CardTitle className="flex items-center gap-2 font-sans text-3xl">
              <Trophy className="size-6 text-accent" />
              {status.currentRank || 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-muted">
            {status.currentRank
              ? status.salaryMaxCycles
                ? `Salary cycles ${status.salaryCyclesPaid ?? 0}/${status.salaryMaxCycles} at this rank`
                : 'Qualified and earning on cycle'
              : 'Keep building volume to unlock Rank 1'}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Left volume</CardDescription>
            <CardTitle className="font-sans text-3xl">
              {formatMinor(status.leftVolumeMinor, { scale: 2, currency: 'USD' })}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
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
            <CardTitle>Next goal: Rank {status.nextRank}</CardTitle>
            <CardDescription>
              Need {formatMinor(leftNeed, { scale: 2, currency: 'USD' })} more on the left and{' '}
              {formatMinor(rightNeed, { scale: 2, currency: 'USD' })} more on the right.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-medium">
                <span>Left</span>
                <span>{leftPct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${leftPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="mb-1.5 flex justify-between text-xs font-medium">
                <span>Right</span>
                <span>{rightPct}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-canvas">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${rightPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm font-medium text-accent">
            You have reached the top rank. Keep growing volume for salary cycles.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All ranks</CardTitle>
          <CardDescription>Matching left and right volume unlocks each level.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {RANK_REWARDS.map((r) => {
            const achieved = status.currentRank >= r.rank
            const leftOk = status.leftVolumeMinor >= r.leftUsd * 100
            const rightOk = status.rightVolumeMinor >= r.rightUsd * 100
            const label = achieved ? 'Qualified' : leftOk && rightOk ? 'Eligible' : 'In progress'
            return (
              <div
                key={r.rank}
                className={cn(
                  'rounded-2xl border px-4 py-3.5',
                  achieved ? 'border-accent/30 bg-accent-soft/30' : 'border-line bg-panel',
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">Rank {r.rank}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      ${r.leftUsd.toLocaleString()} left · ${r.rightUsd.toLocaleString()} right · $
                      {r.rewardUsd} every {r.cycleDays} days · up to {r.maxCycles} cycles
                    </p>
                  </div>
                  <Badge
                    variant={
                      achieved ? 'success' : leftOk && rightOk ? 'warning' : 'secondary'
                    }
                  >
                    {label}
                  </Badge>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
