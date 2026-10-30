import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { LEVEL_COMMISSION_BPS, DIRECT_REFERRAL_BONUS_BPS } from '@/lib/plan'
import { formatMinor } from '@/lib/money'
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
          VFXT restaking tokens. Each level unlocks after you have that many direct referrals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Your referral code</CardDescription>
            <CardTitle className="font-mono text-2xl">{data.referralCode || '—'}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="secondary"
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
          <CardDescription>Only if you are not already referred. Binary placement is server-side.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="VFXT…"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button onClick={() => apply.mutate()} disabled={!code || apply.isPending}>
            Link sponsor
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Level unlock matrix</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {LEVEL_COMMISSION_BPS.map((bps, idx) => {
            const level = idx + 1
            const unlocked = data.unlockedLevels >= level
            const stat = data.levelStats?.find((s) => s.level === level)
            return (
              <div
                key={level}
                className="flex items-center justify-between border-b border-line py-2 text-sm last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">Level {level}</span>
                  <Badge variant={unlocked ? 'success' : 'warning'}>
                    {unlocked ? 'Unlocked' : `Need ${level} directs`}
                  </Badge>
                </div>
                <div className="text-right">
                  <p>{(bps / 100).toFixed(2)}% of capital</p>
                  <p className="text-xs text-ink-muted">
                    Earned {formatMinor(stat?.earnedMinor ?? 0, { scale: 2, currency: 'USD' })}
                  </p>
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Direct team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.directs ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">No directs yet. Share your code to grow levels.</p>
          ) : (
            data.directs.map((d) => (
              <div key={d.uid} className="flex justify-between border-b border-line py-2 text-sm last:border-0">
                <span className="font-mono text-xs">{d.uid}</span>
                <span className="text-ink-muted">{d.email ?? '—'}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
