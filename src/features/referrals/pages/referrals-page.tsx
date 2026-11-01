import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Check, ChevronRight, Copy, Link2, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { LEVEL_COMMISSION_BPS, DIRECT_REFERRAL_BONUS_BPS } from '@/lib/plan'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { applyReferralCode, getAffiliateDashboard } from '@/services/plan-service'

export function ReferralsPage() {
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState<'id' | 'link' | null>(null)
  const queryClient = useQueryClient()
  const dash = useQuery({ queryKey: ['affiliate'], queryFn: getAffiliateDashboard })

  const apply = useMutation({
    mutationFn: () => applyReferralCode(code.trim()),
    onSuccess: async () => {
      toast.success('Sponsor linked')
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
  const referralLink = data.referralCode
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/auth/register?ref=${data.referralCode}`
    : ''

  async function copy(kind: 'id' | 'link') {
    const value = kind === 'id' ? data.referralCode : referralLink
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(kind)
      toast.success(kind === 'id' ? 'User ID copied' : 'Referral link copied')
      window.setTimeout(() => setCopied(null), 1600)
    } catch {
      toast.error('Could not copy')
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Affiliate"
        description={`Invite members with your User ID. Earn ${DIRECT_REFERRAL_BONUS_BPS / 100}% direct VFXT bonus plus up to 7 levels of commission on capital.`}
      />

      <div className="rounded-2xl border border-line bg-panel px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Your User ID</p>
            <p className="mt-1 font-mono text-2xl font-semibold tracking-wide">
              {data.referralCode || '—'}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-ink-muted">{referralLink || '—'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => copy('id')}>
              {copied === 'id' ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied === 'id' ? 'Copied' : 'Copy ID'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => copy('link')}>
              {copied === 'link' ? <Check className="size-4" /> : <Link2 className="size-4" />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Direct referrals</CardDescription>
            <CardTitle className="flex items-center gap-2 font-sans text-3xl">
              <Users className="size-6 text-accent" />
              {data.directCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-muted">
            Levels unlocked: {data.unlockedLevels} / 7
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Level income earned</CardDescription>
            <CardTitle className="font-sans text-3xl">
              {formatMinor(data.levelIncomeMinor, { scale: 2, currency: 'USD' })}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-ink-muted">
            Move it to Withdrawal from Transfer when you want to cash out.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your levels</CardTitle>
          <CardDescription>
            Unlock level N by having at least N direct referrals. Tap an open level to see members.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {LEVEL_COMMISSION_BPS.map((bps, idx) => {
            const level = idx + 1
            const unlocked = data.unlockedLevels >= level
            const stat = data.levelStats?.find((s) => s.level === level)
            const memberCount = level === 1 ? data.directCount : (stat?.memberCount ?? null)
            const canOpen = unlocked && (level === 1 ? data.directCount > 0 : true)
            const row = (
              <div
                className={cn(
                  'flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-[border-color,background-color]',
                  canOpen
                    ? 'border-line bg-panel hover:border-line-strong hover:bg-panel-elevated'
                    : 'border-line/70 bg-canvas opacity-80',
                )}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">Level {level}</p>
                    <Badge variant={unlocked ? 'success' : 'secondary'}>
                      {unlocked
                        ? memberCount != null
                          ? `${memberCount} member${memberCount === 1 ? '' : 's'}`
                          : 'Unlocked'
                        : `Need ${level} direct${level === 1 ? '' : 's'}`}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">
                    {(bps / 100).toFixed(2)}% of capital · earned{' '}
                    {formatMinor(stat?.earnedMinor ?? 0, { scale: 2, currency: 'USD' })}
                  </p>
                </div>
                {canOpen ? <ChevronRight className="size-4 shrink-0 text-ink-subtle" /> : null}
              </div>
            )

            if (!canOpen) return <div key={level}>{row}</div>

            return (
              <Link
                key={level}
                to={`/app/referrals/level/${level}`}
                className="block no-underline"
              >
                {row}
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Direct team</CardTitle>
            <CardDescription>People who joined with your User ID.</CardDescription>
          </div>
          {data.directCount > 0 ? (
            <Button variant="outline" size="sm" asChild>
              <Link to="/app/referrals/level/1">View all</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-2">
          {(data.directs ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-4 py-8 text-center">
              <p className="font-medium">No directs yet</p>
              <p className="mt-1 text-sm text-ink-muted">
                Share your User ID or referral link to start earning.
              </p>
            </div>
          ) : (
            data.directs.slice(0, 8).map((d) => (
              <div
                key={d.uid}
                className="flex items-center justify-between gap-3 rounded-xl border border-line px-3.5 py-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.displayName || 'Member'}</p>
                  <p className="truncate text-xs text-ink-muted">{d.mobile || d.email || '—'}</p>
                </div>
                <span className="shrink-0 font-mono text-xs font-semibold">
                  {d.referralCode || '—'}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Link a sponsor (legacy)</CardTitle>
          <CardDescription>
            New accounts already pick a referral at signup. Use this only if your account was created
            without a sponsor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="sponsor">Sponsor User ID</Label>
            <Input
              id="sponsor"
              placeholder="VFXT…"
              className="font-mono uppercase"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <Button onClick={() => apply.mutate()} disabled={!code.trim() || apply.isPending}>
            {apply.isPending ? 'Linking…' : 'Link sponsor'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
