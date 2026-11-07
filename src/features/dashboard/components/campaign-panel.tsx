import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Gift, Plane, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getMyCampaign } from '@/services/campaign-service'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'

function moneyUsd(cents: number) {
  return formatMinor(cents, { scale: 2, currency: 'USD' })
}

export function CampaignPanel() {
  // In-memory only — refresh / new visit shows the banner again.
  const [skipped, setSkipped] = useState(false)
  const [progressOpen, setProgressOpen] = useState(true)

  const query = useQuery({
    queryKey: ['my-campaign'],
    queryFn: getMyCampaign,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  const data = query.data
  const showModal = Boolean(data?.active && data.showBanner && data.campaign.bannerUrl && !skipped)

  useEffect(() => {
    if (!showModal) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [showModal])

  const tiers = data?.tiers ?? []
  const progress = data?.progress
  const campaign = data?.campaign

  const nextLabel = useMemo(() => {
    if (!progress?.nextTierId) return null
    return tiers.find((t) => t.id === progress.nextTierId)?.name ?? null
  }, [progress?.nextTierId, tiers])

  function skipBanner() {
    setSkipped(true)
  }

  if (query.isLoading || query.isError || !data?.active || !progress || !campaign) {
    return null
  }

  return (
    <>
      {showModal ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center bg-black/60 p-3 backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={campaign.title}
        >
          <div className="relative mt-2 w-full max-w-3xl overflow-hidden rounded-3xl bg-ink shadow-2xl sm:mt-0">
            {/* Top bar — Skip always easy to reach */}
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/70 px-3 py-2.5 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{campaign.title}</p>
                <p className="truncate text-xs text-white/65">{campaign.subtitle}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="bg-white/15 text-white hover:bg-white/25"
                  onClick={skipBanner}
                >
                  Skip
                </Button>
                <button
                  type="button"
                  onClick={skipBanner}
                  className="grid size-9 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25"
                  aria-label="Close campaign banner"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <img
              src={campaign.bannerUrl!}
              alt={campaign.title}
              className="block max-h-[70vh] w-full object-contain object-top"
            />
          </div>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardDescription className="flex items-center gap-2 text-accent">
              <Gift className="size-3.5" />
              {campaign.subtitle || 'Campaign progress'}
            </CardDescription>
            <CardTitle className="font-sans text-lg">{campaign.title}</CardTitle>
            <p className="text-sm text-ink-muted">
              Package volume {moneyUsd(progress.volumeUsdCents)} · Direct referrals{' '}
              {progress.directReferrals}/{progress.requiredDirectReferrals}
              {progress.referralsMet ? ' ✓' : ''}
              {nextLabel ? ` · Next: ${nextLabel}` : ''}
            </p>
          </div>
          <div className="flex gap-2">
            {campaign.bannerUrl && skipped ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setSkipped(false)}>
                View banner
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setProgressOpen((v) => !v)}
            >
              {progressOpen ? 'Hide' : 'Show'} details
            </Button>
          </div>
        </CardHeader>
        {progressOpen ? (
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-xs">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium',
                  progress.referralsMet
                    ? 'bg-success/10 text-success'
                    : 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
                )}
              >
                <Users className="size-3.5" />
                {progress.referralsMet
                  ? 'Referral requirement met'
                  : `${Math.max(0, progress.requiredDirectReferrals - progress.directReferrals)} more direct referrals needed`}
              </span>
              {progress.highestTierId ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-1 font-medium text-accent">
                  <Plane className="size-3.5" />
                  Highest:{' '}
                  {tiers.find((t) => t.id === progress.highestTierId)?.name ?? progress.highestTierId}
                </span>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {tiers.map((tier) => (
                <div
                  key={tier.id}
                  className={cn(
                    'rounded-2xl border p-4',
                    tier.achieved
                      ? 'border-success/40 bg-success/5'
                      : 'border-border/70 bg-surface-muted/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{tier.name}</p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {moneyUsd(tier.targetUsdCents)} · {tier.nightsLabel}
                      </p>
                    </div>
                    {tier.achieved ? (
                      <CheckCircle2 className="size-5 shrink-0 text-success" />
                    ) : null}
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        tier.achieved ? 'bg-success' : 'bg-accent',
                      )}
                      style={{ width: `${tier.progressPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-ink-muted">
                    {tier.achieved
                      ? progress.referralsMet
                        ? 'Qualified'
                        : 'Volume met — finish referrals to qualify'
                      : `${tier.progressPct}% · ${moneyUsd(Math.max(0, tier.targetUsdCents - progress.volumeUsdCents))} to go`}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        ) : null}
      </Card>
    </>
  )
}
