import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
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
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/app/referrals" className="no-underline">
            <ArrowLeft className="size-3.5" />
            Affiliate network
          </Link>
        </Button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-4xl">Level {level}</h1>
            <p className="mt-1 text-ink-muted">
              {(rateBps / 100).toFixed(2)}% commission ·{' '}
              {level === 1 ? 'Your direct referrals' : `Downline at depth ${level}`}
            </p>
          </div>
          <Badge variant={data.unlocked ? 'success' : 'warning'}>
            {data.unlocked ? `${data.count} member${data.count === 1 ? '' : 's'}` : 'Locked'}
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
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle className="font-sans text-lg">Members</CardTitle>
            <CardDescription>
              {data.count === 0
                ? 'No members on this level yet.'
                : `Showing ${data.count} member${data.count === 1 ? '' : 's'}.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.members.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={Users}
                  title="No directs on this level"
                  description="Share your referral link to grow your team."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <tr>
                      <TH>Name</TH>
                      <TH>Mobile</TH>
                      <TH>Email</TH>
                      <TH>Referral code</TH>
                      <TH>Joined</TH>
                    </tr>
                  </THead>
                  <TBody>
                    {data.members.map((m) => (
                      <TR key={m.uid}>
                        <TD>
                          <div className="min-w-0">
                            <p className="font-medium">{m.displayName || '—'}</p>
                            <p className="truncate font-mono text-[11px] text-ink-subtle">{m.uid}</p>
                          </div>
                        </TD>
                        <TD>{m.mobile || '—'}</TD>
                        <TD className="max-w-[180px] truncate text-ink-muted">{m.email || '—'}</TD>
                        <TD className="font-mono text-sm font-semibold">{m.referralCode || '—'}</TD>
                        <TD className="whitespace-nowrap text-ink-muted">
                          {m.createdAt ? format(new Date(m.createdAt), 'dd MMM yyyy') : '—'}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
