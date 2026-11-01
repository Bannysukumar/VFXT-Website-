import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { LEVEL_COMMISSION_BPS } from '@/lib/plan'
import { getAffiliateLevelMembers } from '@/services/plan-service'

export function ReferralLevelPage() {
  const { level: levelParam } = useParams<{ level: string }>()
  const level = Number.parseInt(levelParam ?? '', 10)
  const valid = Number.isFinite(level) && level >= 1 && level <= LEVEL_COMMISSION_BPS.length

  const query = useQuery({
    queryKey: ['affiliate', 'level', level],
    queryFn: () => getAffiliateLevelMembers(level),
    enabled: valid,
  })

  if (!valid) {
    return (
      <div className="space-y-4">
        <ErrorState message={`Unknown level: ${levelParam ?? ''}`} />
        <Button asChild variant="secondary">
          <Link to="/app/referrals">Back to affiliate</Link>
        </Button>
      </div>
    )
  }

  if (query.isLoading) return <LoadingState label={`Loading level ${level}…`} />
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  }

  const data = query.data!
  const rateBps = LEVEL_COMMISSION_BPS[level - 1] ?? 0

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/app/referrals" className="no-underline">
            <ArrowLeft className="size-3.5" />
            Affiliate
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PageHeader
            title={`Level ${level}`}
            description={
              level === 1
                ? `Your direct referrals · ${(rateBps / 100).toFixed(2)}% of capital`
                : `Members at depth ${level} · ${(rateBps / 100).toFixed(2)}% of capital`
            }
          />
          <Badge variant={data.unlocked ? 'success' : 'warning'}>
            {data.unlocked
              ? `${data.count} member${data.count === 1 ? '' : 's'}`
              : 'Locked'}
          </Badge>
        </div>
      </div>

      {!data.unlocked ? (
        <EmptyState
          icon={Users}
          title={`Level ${level} is locked`}
          description={`You need ${level} direct referral${level === 1 ? '' : 's'} to unlock this level.`}
          action={
            <Button asChild>
              <Link to="/app/referrals">Back to levels</Link>
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>
              {data.count === 0
                ? 'No members on this level yet.'
                : `Showing ${data.count} member${data.count === 1 ? '' : 's'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nobody here yet"
                description="Share your referral link to grow your team."
              />
            ) : (
              <ul className="space-y-3">
                {data.members.map((m) => (
                  <li
                    key={m.uid}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{m.displayName || 'Member'}</p>
                      <p className="mt-0.5 truncate text-sm text-ink-muted">
                        {[m.mobile, m.email].filter(Boolean).join(' · ') || '—'}
                      </p>
                      <p className="mt-1 text-xs text-ink-subtle">
                        Joined{' '}
                        {m.createdAt ? format(new Date(m.createdAt), 'dd MMM yyyy') : '—'}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-canvas px-2.5 py-1.5 font-mono text-sm font-semibold">
                      {m.referralCode || '—'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
