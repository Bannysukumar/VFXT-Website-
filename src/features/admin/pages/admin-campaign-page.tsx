import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ImagePlus, Plane, RefreshCw, Save, Sparkles, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import {
  getAdminCampaign,
  getAdminCampaignStats,
  seedAdminCampaignDefaults,
  updateAdminCampaign,
  uploadCampaignBanner,
  type CampaignTier,
} from '@/services/campaign-service'
import { formatMinor } from '@/lib/money'

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value.trim()) return null
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString()
}

function moneyUsd(cents: number) {
  return formatMinor(cents, { scale: 2, currency: 'USD' })
}

export function AdminCampaignPage() {
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [enabled, setEnabled] = useState(true)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [bannerUrl, setBannerUrl] = useState('')
  const [storagePath, setStoragePath] = useState<string | null>(null)
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [maxShows, setMaxShows] = useState('0')
  const [requiredDirectReferrals, setRequiredDirectReferrals] = useState('3')
  const [volumeSource, setVolumeSource] = useState<'deposits' | 'staking' | 'deposits_and_staking'>(
    'deposits_and_staking',
  )
  const [tiers, setTiers] = useState<CampaignTier[]>([])
  const [uploadPct, setUploadPct] = useState<number | null>(null)

  const campaignQuery = useQuery({
    queryKey: ['admin', 'campaign'],
    queryFn: getAdminCampaign,
  })
  const statsQuery = useQuery({
    queryKey: ['admin', 'campaign-stats'],
    queryFn: getAdminCampaignStats,
  })

  useEffect(() => {
    const c = campaignQuery.data?.campaign
    if (!c) return
    setEnabled(c.enabled)
    setTitle(c.title)
    setSubtitle(c.subtitle)
    setBannerUrl(c.bannerUrl ?? '')
    setStoragePath(c.storagePath)
    setStartsAt(toLocalInput(c.startsAt))
    setEndsAt(toLocalInput(c.endsAt))
    setMaxShows(String(c.maxShows ?? 0))
    setRequiredDirectReferrals(String(c.requiredDirectReferrals ?? 3))
    setVolumeSource(c.volumeSource)
    setTiers(c.tiers ?? [])
  }, [campaignQuery.data])

  const save = useMutation({
    mutationFn: () =>
      updateAdminCampaign({
        enabled,
        title: title.trim(),
        subtitle: subtitle.trim(),
        bannerUrl: bannerUrl.trim() || null,
        storagePath,
        startsAt: fromLocalInput(startsAt),
        endsAt: fromLocalInput(endsAt),
        maxShows: Number.parseInt(maxShows, 10) || 0,
        requiredDirectReferrals: Number.parseInt(requiredDirectReferrals, 10) || 0,
        volumeSource,
        tiers: tiers.map((t, i) => ({
          ...t,
          targetUsdCents: Math.floor(Number(t.targetUsdCents) || 0),
          sortOrder: t.sortOrder || i + 1,
        })),
      }),
    onSuccess: async () => {
      toast.success('Campaign settings saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'campaign'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'campaign-stats'] })
      await queryClient.invalidateQueries({ queryKey: ['my-campaign'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  })

  const seed = useMutation({
    mutationFn: seedAdminCampaignDefaults,
    onSuccess: async (res) => {
      toast.success(res.seeded ? 'Default Diwali campaign created' : 'Campaign already exists')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'campaign'] })
      await queryClient.invalidateQueries({ queryKey: ['admin', 'campaign-stats'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Seed failed'),
  })

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!file.type.startsWith('image/')) throw new Error('Choose an image file (JPG/PNG/WebP)')
      if (file.size > 8 * 1024 * 1024) throw new Error('Image must be under 8 MB')
      setUploadPct(0)
      return uploadCampaignBanner(file, setUploadPct)
    },
    onSuccess: async (uploaded) => {
      setBannerUrl(uploaded.downloadUrl)
      setStoragePath(uploaded.storagePath)
      setUploadPct(null)
      if (fileRef.current) fileRef.current.value = ''
      toast.success('Banner uploaded — click Save to publish')
    },
    onError: (e: Error) => {
      setUploadPct(null)
      toast.error(e.message || 'Upload failed')
    },
  })

  if (campaignQuery.isLoading) return <LoadingState label="Loading campaign…" />
  if (campaignQuery.isError) {
    return (
      <ErrorState
        message={campaignQuery.error.message}
        onRetry={() => campaignQuery.refetch()}
      />
    )
  }

  const stats = statsQuery.data

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard campaign"
        description="November Mining Special — banner, trip tiers, period, show-count, and achievement tracking."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => seed.mutate()} disabled={seed.isPending}>
              <Sparkles className="size-3.5" />
              Seed defaults
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => statsQuery.refetch()}
              disabled={statsQuery.isFetching}
            >
              <RefreshCw className="size-3.5" />
              Refresh stats
            </Button>
            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="size-3.5" />
              Save
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Achieved', value: stats?.totals.achieved ?? '—' },
          { label: 'In progress', value: stats?.totals.inProgress ?? '—' },
          { label: 'Pending / not started', value: stats?.totals.pending ?? '—' },
          { label: 'Tracked users', value: stats?.totals.trackedUsers ?? '—' },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-2">
              <CardDescription>{s.label}</CardDescription>
              <CardTitle className="font-display text-3xl tabular-nums">{s.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-base">Campaign settings</CardTitle>
            <CardDescription>
              Enable/disable, date window, and how many times the banner appears after login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3">
              <div>
                <p className="text-sm font-medium">Enabled</p>
                <p className="text-xs text-ink-muted">
                  {enabled ? 'Banner can show to members' : 'Hidden from all members'}
                </p>
              </div>
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
            </label>

            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitle">Subtitle</Label>
              <Textarea
                id="subtitle"
                rows={2}
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="startsAt">Starts</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endsAt">Ends</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxShows">Banner show count</Label>
                <Input
                  id="maxShows"
                  type="number"
                  min={0}
                  value={maxShows}
                  onChange={(e) => setMaxShows(e.target.value)}
                />
                <p className="text-[11px] text-ink-muted">
                  0 = always while active. 10 = show on the first 10 dashboard visits after login.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="refs">Required direct referrals</Label>
                <Input
                  id="refs"
                  type="number"
                  min={0}
                  value={requiredDirectReferrals}
                  onChange={(e) => setRequiredDirectReferrals(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="volumeSource">Volume source</Label>
              <select
                id="volumeSource"
                className="flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                value={volumeSource}
                onChange={(e) =>
                  setVolumeSource(e.target.value as typeof volumeSource)
                }
              >
                <option value="deposits_and_staking">Deposits + staking</option>
                <option value="deposits">Deposits only</option>
                <option value="staking">Staking only</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-base">Banner image</CardTitle>
            <CardDescription>Upload a new creative or keep the default Diwali banner.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bannerUrl ? (
              <div className="overflow-hidden rounded-2xl border border-border/70 bg-ink">
                <img src={bannerUrl} alt="Campaign banner preview" className="w-full object-cover" />
              </div>
            ) : (
              <div className="grid h-40 place-items-center rounded-2xl border border-dashed border-border/80 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-2">
                  <ImagePlus className="size-4" /> No banner set
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="bannerUrl">Banner URL</Label>
              <Input
                id="bannerUrl"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="/campaign-banner.jpg or https://…"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) upload.mutate(file)
                }}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
              >
                <Upload className="size-3.5" />
                {upload.isPending ? `Uploading ${uploadPct ?? 0}%` : 'Upload image'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setBannerUrl('/campaign-banner.jpg')
                  setStoragePath(null)
                }}
              >
                Use default
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base">Reward trip tiers</CardTitle>
          <CardDescription>Targets match the creative (Thailand / Vietnam / Dubai / Singapore).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {tiers.map((tier, index) => (
            <div
              key={tier.id}
              className="grid gap-3 rounded-2xl border border-border/70 p-3 sm:grid-cols-[1fr_140px_1fr]"
            >
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={tier.name}
                  onChange={(e) => {
                    const next = [...tiers]
                    next[index] = { ...tier, name: e.target.value }
                    setTiers(next)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Target (USD)</Label>
                <Input
                  type="number"
                  min={1}
                  value={(tier.targetUsdCents / 100).toString()}
                  onChange={(e) => {
                    const usd = Number(e.target.value)
                    const next = [...tiers]
                    next[index] = {
                      ...tier,
                      targetUsdCents: Math.max(1, Math.round((Number.isFinite(usd) ? usd : 0) * 100)),
                    }
                    setTiers(next)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Stay label</Label>
                <Input
                  value={tier.nightsLabel}
                  onChange={(e) => {
                    const next = [...tiers]
                    next[index] = { ...tier, nightsLabel: e.target.value }
                    setTiers(next)
                  }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base">Tier achievement stats</CardTitle>
          <CardDescription>
            Updated when members open the dashboard. Pending = in progress + not started.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsQuery.isLoading ? (
            <LoadingState label="Loading stats…" />
          ) : statsQuery.isError ? (
            <ErrorState message={statsQuery.error.message} onRetry={() => statsQuery.refetch()} />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Tier</TH>
                  <TH>Target</TH>
                  <TH>Achieved</TH>
                  <TH>Working toward</TH>
                </TR>
              </THead>
              <TBody>
                {(stats?.tiers ?? []).map((t) => (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.name}</TD>
                    <TD className="tabular">{moneyUsd(t.targetUsdCents)}</TD>
                    <TD className="tabular">{t.achieved}</TD>
                    <TD className="tabular">{t.inProgressToward}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base flex items-center gap-2">
            <Plane className="size-4 text-accent" />
            Top achievers
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!stats?.topAchievers?.length ? (
            <p className="text-sm text-ink-muted">No achievers yet — stats fill as users visit the dashboard.</p>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>User ID</TH>
                  <TH>Name</TH>
                  <TH>Volume</TH>
                  <TH>Directs</TH>
                  <TH>Highest tier</TH>
                </TR>
              </THead>
              <TBody>
                {stats.topAchievers.map((u) => (
                  <TR key={u.userId}>
                    <TD className="font-mono text-xs">{u.referralCode || u.userId.slice(0, 8)}</TD>
                    <TD>{u.displayName || '—'}</TD>
                    <TD className="tabular">{moneyUsd(u.volumeUsdCents)}</TD>
                    <TD className="tabular">{u.directReferrals}</TD>
                    <TD>{u.highestTierId || '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
