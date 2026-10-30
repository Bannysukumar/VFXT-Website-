import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { getAdminPlatformSettings, updatePlatformSettings } from '@/services/admin-service'
import { cn } from '@/lib/utils'

type TabId = 'contact' | 'footer' | 'plan' | 'withdraw' | 'hotwallet'

const tabs: { id: TabId; label: string }[] = [
  { id: 'contact', label: 'Contact' },
  { id: 'footer', label: 'Footer' },
  { id: 'plan', label: 'Plan' },
  { id: 'withdraw', label: 'Withdraw' },
  { id: 'hotwallet', label: 'Hot wallet pool' },
]

interface LockedPackageRow {
  id: string
  days: number
  multiplier: number
  bonusTokenPct: number
  label: string
  enabled: boolean
}

interface RankRewardRow {
  rank: number
  leftUsd: number
  rightUsd: number
  rewardUsd: number
  cycleDays: number
  enabled: boolean
}

export function AdminSettingsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<TabId>('contact')

  const settings = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: getAdminPlatformSettings,
  })

  const [contact, setContact] = useState<Record<string, string>>({})
  const [footerTagline, setFooterTagline] = useState('')
  const [footerCopyright, setFooterCopyright] = useState('')
  const [footerColumnsJson, setFooterColumnsJson] = useState('[]')
  const [minStakeUsdCents, setMinStakeUsdCents] = useState('')
  const [dailyRateBps, setDailyRateBps] = useState('')
  const [levelCommissionBps, setLevelCommissionBps] = useState('')
  const [directReferralBonusBps, setDirectReferralBonusBps] = useState('')
  const [lockedPackages, setLockedPackages] = useState<LockedPackageRow[]>([])
  const [rankRewards, setRankRewards] = useState<RankRewardRow[]>([])
  const [minWithdrawUsdCents, setMinWithdrawUsdCents] = useState('')
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState(false)
  const [requireProfileAddress, setRequireProfileAddress] = useState(true)
  const [multiWalletEnabled, setMultiWalletEnabled] = useState(false)

  useEffect(() => {
    const s = settings.data
    if (!s) return
    const c = s.contact as Record<string, string> | undefined
    if (c) {
      setContact({
        companyName: c.companyName ?? '',
        email: c.email ?? '',
        phone: c.phone ?? '',
        addressLine1: c.addressLine1 ?? '',
        addressLine2: c.addressLine2 ?? '',
        city: c.city ?? '',
        region: c.region ?? '',
        postalCode: c.postalCode ?? '',
        country: c.country ?? '',
        supportHours: c.supportHours ?? '',
      })
    }
    const f = s.footer as { tagline?: string; copyright?: string; columns?: unknown[] } | undefined
    if (f) {
      setFooterTagline(f.tagline ?? '')
      setFooterCopyright(f.copyright ?? '')
      setFooterColumnsJson(JSON.stringify(f.columns ?? [], null, 2))
    }
    const p = s.plan as Record<string, unknown> | undefined
    if (p) {
      setMinStakeUsdCents(String(p.minStakeUsdCents ?? ''))
      setDailyRateBps(String(p.dailyRateBps ?? ''))
      setLevelCommissionBps(Array.isArray(p.levelCommissionBps) ? p.levelCommissionBps.join(', ') : '')
      setDirectReferralBonusBps(String(p.directReferralBonusBps ?? ''))
      setLockedPackages((p.lockedPackages as LockedPackageRow[]) ?? [])
      setRankRewards((p.rankRewards as RankRewardRow[]) ?? [])
    }
    const w = s.withdraw as Record<string, unknown> | undefined
    if (w) {
      setMinWithdrawUsdCents(String(w.minWithdrawUsdCents ?? ''))
      setAutoWithdrawEnabled(Boolean(w.autoWithdrawEnabled))
      setRequireProfileAddress(w.requireProfileAddress !== false)
    }
    const h = s.hotWalletPool as { multiWalletEnabled?: boolean } | undefined
    if (h) setMultiWalletEnabled(Boolean(h.multiWalletEnabled))
  }, [settings.data])

  const save = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: async () => {
      toast.success('Settings saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'platform-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['platform', 'public'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveContact = () => save.mutate({ contact })
  const saveFooter = () => {
    try {
      const columns = JSON.parse(footerColumnsJson) as unknown
      save.mutate({
        footer: { tagline: footerTagline, copyright: footerCopyright, columns },
      })
    } catch {
      toast.error('Footer columns must be valid JSON')
    }
  }
  const savePlan = () => {
    const bps = levelCommissionBps
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => Number.parseInt(s, 10))
    if (bps.some((n) => !Number.isFinite(n))) {
      toast.error('Level commission bps must be comma-separated integers')
      return
    }
    save.mutate({
      plan: {
        minStakeUsdCents: Number.parseInt(minStakeUsdCents, 10),
        dailyRateBps: Number.parseInt(dailyRateBps, 10),
        levelCommissionBps: bps,
        directReferralBonusBps: Number.parseInt(directReferralBonusBps, 10),
        lockedPackages,
        rankRewards,
      },
    })
  }
  const saveWithdraw = () =>
    save.mutate({
      withdraw: {
        minWithdrawUsdCents: Number.parseInt(minWithdrawUsdCents, 10),
        autoWithdrawEnabled,
        requireProfileAddress,
      },
    })
  const saveHotWallet = () => save.mutate({ hotWalletPool: { multiWalletEnabled } })

  if (settings.isLoading) return <LoadingState />
  if (settings.isError) {
    return <ErrorState message={settings.error.message} onRetry={() => settings.refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="Platform settings"
        description="Contact details, footer content, plan economics, withdrawals, and hot wallet pool."
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.id)}
            className={cn(tab === t.id && 'shadow-sm')}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'contact' ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-sans text-lg">
              <Settings2 className="size-5" />
              Contact details
            </CardTitle>
            <CardDescription>Shown on the public contact page when loaded from settings.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ['companyName', 'Company name'],
                ['email', 'Email'],
                ['phone', 'Phone'],
                ['addressLine1', 'Address line 1'],
                ['addressLine2', 'Address line 2'],
                ['city', 'City'],
                ['region', 'Region'],
                ['postalCode', 'Postal code'],
                ['country', 'Country'],
                ['supportHours', 'Support hours'],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className={key === 'supportHours' ? 'sm:col-span-2' : undefined}>
                <Label htmlFor={`c-${key}`}>{label}</Label>
                <Input
                  id={`c-${key}`}
                  className="mt-2"
                  value={contact[key] ?? ''}
                  onChange={(e) => setContact((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}
            <div className="sm:col-span-2">
              <Button onClick={saveContact} disabled={save.isPending}>
                <Save className="size-4" />
                Save contact
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'footer' ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Footer</CardTitle>
            <CardDescription>Tagline, copyright, and link columns (JSON array).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="f-tag">Tagline</Label>
              <Input id="f-tag" value={footerTagline} onChange={(e) => setFooterTagline(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-copy">Copyright</Label>
              <Input id="f-copy" value={footerCopyright} onChange={(e) => setFooterCopyright(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="f-cols">Columns JSON</Label>
              <Textarea
                id="f-cols"
                className="min-h-48 font-mono text-xs"
                value={footerColumnsJson}
                onChange={(e) => setFooterColumnsJson(e.target.value)}
              />
            </div>
            <Button onClick={saveFooter} disabled={save.isPending}>
              <Save className="size-4" />
              Save footer
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'plan' ? (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-sans text-lg">Plan core</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Min stake (USD cents)</Label>
                <Input value={minStakeUsdCents} onChange={(e) => setMinStakeUsdCents(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Daily rate (bps)</Label>
                <Input value={dailyRateBps} onChange={(e) => setDailyRateBps(e.target.value)} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Level commission bps (comma-separated)</Label>
                <Input value={levelCommissionBps} onChange={(e) => setLevelCommissionBps(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Direct referral bonus (bps)</Label>
                <Input value={directReferralBonusBps} onChange={(e) => setDirectReferralBonusBps(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="font-sans text-lg">Locked packages</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <tr>
                    <TH>Label</TH>
                    <TH>Days</TH>
                    <TH>Mult.</TH>
                    <TH>Bonus %</TH>
                    <TH>Enabled</TH>
                  </tr>
                </THead>
                <TBody>
                  {lockedPackages.map((row, i) => (
                    <TR key={row.id}>
                      <TD>
                        <Input
                          className="h-9 min-w-32"
                          value={row.label}
                          onChange={(e) => {
                            const next = [...lockedPackages]
                            next[i] = { ...row, label: e.target.value }
                            setLockedPackages(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <Input
                          className="h-9 w-20"
                          value={row.days}
                          onChange={(e) => {
                            const next = [...lockedPackages]
                            next[i] = { ...row, days: Number(e.target.value) }
                            setLockedPackages(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <Input
                          className="h-9 w-20"
                          value={row.multiplier}
                          onChange={(e) => {
                            const next = [...lockedPackages]
                            next[i] = { ...row, multiplier: Number(e.target.value) }
                            setLockedPackages(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <Input
                          className="h-9 w-20"
                          value={row.bonusTokenPct}
                          onChange={(e) => {
                            const next = [...lockedPackages]
                            next[i] = { ...row, bonusTokenPct: Number(e.target.value) }
                            setLockedPackages(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <NativeSelect
                          className="h-9"
                          value={row.enabled ? '1' : '0'}
                          onChange={(e) => {
                            const next = [...lockedPackages]
                            next[i] = { ...row, enabled: e.target.value === '1' }
                            setLockedPackages(next)
                          }}
                        >
                          <option value="1">Yes</option>
                          <option value="0">No</option>
                        </NativeSelect>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle className="font-sans text-lg">Rank rewards</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <tr>
                    <TH>Rank</TH>
                    <TH>Left USD</TH>
                    <TH>Right USD</TH>
                    <TH>Reward USD</TH>
                    <TH>Cycle days</TH>
                    <TH>Enabled</TH>
                  </tr>
                </THead>
                <TBody>
                  {rankRewards.map((row, i) => (
                    <TR key={row.rank}>
                      <TD className="tabular">{row.rank}</TD>
                      <TD>
                        <Input
                          className="h-9 w-24"
                          value={row.leftUsd}
                          onChange={(e) => {
                            const next = [...rankRewards]
                            next[i] = { ...row, leftUsd: Number(e.target.value) }
                            setRankRewards(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <Input
                          className="h-9 w-24"
                          value={row.rightUsd}
                          onChange={(e) => {
                            const next = [...rankRewards]
                            next[i] = { ...row, rightUsd: Number(e.target.value) }
                            setRankRewards(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <Input
                          className="h-9 w-24"
                          value={row.rewardUsd}
                          onChange={(e) => {
                            const next = [...rankRewards]
                            next[i] = { ...row, rewardUsd: Number(e.target.value) }
                            setRankRewards(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <Input
                          className="h-9 w-20"
                          value={row.cycleDays}
                          onChange={(e) => {
                            const next = [...rankRewards]
                            next[i] = { ...row, cycleDays: Number(e.target.value) }
                            setRankRewards(next)
                          }}
                        />
                      </TD>
                      <TD>
                        <NativeSelect
                          className="h-9"
                          value={row.enabled ? '1' : '0'}
                          onChange={(e) => {
                            const next = [...rankRewards]
                            next[i] = { ...row, enabled: e.target.value === '1' }
                            setRankRewards(next)
                          }}
                        >
                          <option value="1">Yes</option>
                          <option value="0">No</option>
                        </NativeSelect>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          <Button onClick={savePlan} disabled={save.isPending}>
            <Save className="size-4" />
            Save plan
          </Button>
        </div>
      ) : null}

      {tab === 'withdraw' ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Withdrawals</CardTitle>
          </CardHeader>
          <CardContent className="grid max-w-md gap-4">
            <div className="space-y-2">
              <Label>Min withdraw (USD cents)</Label>
              <Input value={minWithdrawUsdCents} onChange={(e) => setMinWithdrawUsdCents(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Auto-withdraw enabled</Label>
              <NativeSelect
                value={autoWithdrawEnabled ? '1' : '0'}
                onChange={(e) => setAutoWithdrawEnabled(e.target.value === '1')}
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </NativeSelect>
            </div>
            <div className="space-y-2">
              <Label>Require profile address</Label>
              <NativeSelect
                value={requireProfileAddress ? '1' : '0'}
                onChange={(e) => setRequireProfileAddress(e.target.value === '1')}
              >
                <option value="1">Yes</option>
                <option value="0">No</option>
              </NativeSelect>
            </div>
            <Button onClick={saveWithdraw} disabled={save.isPending}>
              <Save className="size-4" />
              Save withdraw settings
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'hotwallet' ? (
        <Card>
          <CardHeader>
            <CardTitle className="font-sans text-lg">Hot wallet pool</CardTitle>
            <CardDescription>When enabled, deposits and withdrawals rotate across pool wallets.</CardDescription>
          </CardHeader>
          <CardContent className="grid max-w-md gap-4">
            <div className="space-y-2">
              <Label>Multi-wallet enabled</Label>
              <NativeSelect
                value={multiWalletEnabled ? '1' : '0'}
                onChange={(e) => setMultiWalletEnabled(e.target.value === '1')}
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </NativeSelect>
            </div>
            <Button onClick={saveHotWallet} disabled={save.isPending}>
              <Save className="size-4" />
              Save pool settings
            </Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
