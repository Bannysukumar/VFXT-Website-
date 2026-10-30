import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { LEVEL_COMMISSION_BPS, DIRECT_REFERRAL_BONUS_BPS } from '@/lib/plan'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { applyReferralCode, getAffiliateDashboard } from '@/services/plan-service'

export function ReferralsPage() {
  const [code, setCode] = useState('')
  const queryClient = useQueryClient()
  const dash = useQuery({ queryKey: ['affiliate'], queryFn: getAffiliateDashboard })

  const apply = useMutation({
    mutationFn: () => applyReferralCode(code.trim()),
    onSuccess: async () => {
      toast.success('Referral linked')
      setCode('')
      await queryClient.invalidateQueries({ queryKey: ['affiliate'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (dash.isLoading) return <LoadingState label="Loading affiliate dashboard…" />
  if (dash.isError) {
    return <ErrorState message={dash.error.message} onRetry={() => dash.refetch()} />
  }

  const data = dash.data!

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">Affiliate network</h1>
        <p className="mt-1 text-ink-muted">
          Seven-level commissions on capital plus {DIRECT_REFERRAL_BONUS_BPS / 100}% direct bonus in
          VFXT restaking tokens. Tap an unlocked level to view members.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Your unique referral link</CardDescription>
            <CardTitle className="break-all font-mono text-lg">
              {data.referralCode
                ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?ref=${data.referralCode}`
                : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                const link = `${window.location.origin}/auth/register?ref=${data.referralCode}`
                await navigator.clipboard.writeText(link)
                toast.success('Referral link copied')
              }}
            >
              Copy link
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(data.referralCode)
                toast.success('Code copied')
              }}
            >
              Copy code
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Direct referrals</CardDescription>
            <CardTitle className="font-sans text-3xl">{data.directCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-muted">
            Levels unlocked: {data.unlockedLevels} / 7
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Level income (lifetime view)</CardDescription>
            <CardTitle className="font-sans text-3xl">
              {formatMinor(data.levelIncomeMinor, { scale: 2, currency: 'USD' })}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Apply a sponsor code</CardTitle>
          <CardDescription>
            New signups must enter a referral on register. Use this only if your account was created
            without a sponsor (legacy). Binary placement is server-side.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input placeholder="VFXT…" value={code} onChange={(e) => setCode(e.target.value)} />
          <Button onClick={() => apply.mutate()} disabled={!code || apply.isPending}>
            Link sponsor
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Level unlock matrix</CardTitle>
          <CardDescription>Open a level to see member names and details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1 p-2 sm:p-4">
          {LEVEL_COMMISSION_BPS.map((bps, idx) => {
            const level = idx + 1
            const unlocked = data.unlockedLevels >= level
            const stat = data.levelStats?.find((s) => s.level === level)
            const memberCount =
              level === 1 ? data.directCount : (stat?.memberCount ?? null)
            const canOpen = unlocked && (level === 1 ? data.directCount > 0 : true)
            const row = (
              <div
                className={cn(
                  'flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-sm transition-colors',
                  canOpen && 'hover:bg-panel-elevated',
                  !unlocked && 'opacity-70',
                )}
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-medium">Level {level}</span>
                  <Badge variant={unlocked ? 'success' : 'warning'}>
                    {unlocked
                      ? memberCount != null
                        ? `${memberCount} member${memberCount === 1 ? '' : 's'}`
                        : 'Unlocked'
                      : `Need ${level} direct${level === 1 ? '' : 's'}`}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p>{(bps / 100).toFixed(2)}% of capital</p>
                    <p className="text-xs text-ink-muted">
                      Earned {formatMinor(stat?.earnedMinor ?? 0, { scale: 2, currency: 'USD' })}
                    </p>
                  </div>
                  {canOpen ? <ChevronRight className="size-4 shrink-0 text-ink-subtle" /> : null}
                </div>
              </div>
            )

            if (!canOpen) {
              return (
                <div key={level} className="border-b border-line last:border-0">
                  {row}
                </div>
              )
            }

            return (
              <Link
                key={level}
                to={`/app/referrals/level/${level}`}
                className="block border-b border-line no-underline last:border-0"
              >
                {row}
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="font-sans text-lg">Direct team</CardTitle>
            <CardDescription>Level 1 members (quick view).</CardDescription>
          </div>
          {data.directCount > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/referrals/level/1">View all</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.directs ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">No directs yet. Share your code to grow levels.</p>
          ) : (
            data.directs.slice(0, 8).map((d) => (
              <div
                key={d.uid}
                className="flex items-center justify-between gap-3 border-b border-line py-2 text-sm last:border-0"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.displayName || '—'}</p>
                  <p className="truncate text-xs text-ink-muted">{d.mobile || d.email || d.uid}</p>
                </div>
                <span className="shrink-0 font-mono text-xs text-ink-muted">
                  {d.referralCode || '—'}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
