import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, Gift, Plane, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getMyCampaign } from '@/services/campaign-service'
import { formatMinor } from '@/lib/money'
import { cn } from '@/lib/utils'

function moneyUsd(cents: number) {
  return formatMinor(cents, { scale: 2, currency: 'USD' })
}

export function CampaignPanel() {
  const query = useQuery({
    queryKey: ['my-campaign'],
    queryFn: getMyCampaign,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  if (query.isLoading || query.isError || !query.data?.active || !query.data.progress) {
    return null
  }

  const { campaign, progress, showBanner, tiers = [] } = query.data

  return (
    <div className="space-y-4">
      {showBanner && campaign.bannerUrl ? (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-ink shadow-lift">
          <img
            src={campaign.bannerUrl}
            alt={campaign.title}
            className="block w-full object-cover object-top"
          />
        </div>
      ) : null}

      <Card>
        <CardHeader className="space-y-1">
          <CardDescription className="flex items-center gap-2 text-accent">
            <Gift className="size-3.5" />
            {campaign.subtitle || 'Campaign progress'}
          </CardDescription>
          <CardTitle className="font-sans text-lg">{campaign.title}</CardTitle>
          <p className="text-sm text-ink-muted">
            Package volume {moneyUsd(progress.volumeUsdCents)} · Direct referrals{' '}
            {progress.directReferrals}/{progress.requiredDirectReferrals}
            {progress.referralsMet ? ' ✓' : ''}
          </p>
        </CardHeader>
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
                Highest: {tiers.find((t) => t.id === progress.highestTierId)?.name ?? progress.highestTierId}
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
      </Card>
    </div>
  )
}
