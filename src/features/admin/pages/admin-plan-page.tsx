import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { getAdminPlatformSettings, updatePlatformSettings } from '@/services/admin-service'

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

export function AdminPlanPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: getAdminPlatformSettings,
  })

  const [minStakeUsdCents, setMinStakeUsdCents] = useState('')
  const [dailyRateBps, setDailyRateBps] = useState('')
  const [levelCommissionBps, setLevelCommissionBps] = useState('')
  const [directReferralBonusBps, setDirectReferralBonusBps] = useState('')
  const [lockedPackages, setLockedPackages] = useState<LockedPackageRow[]>([])
  const [rankRewards, setRankRewards] = useState<RankRewardRow[]>([])

  useEffect(() => {
    const p = settings.data?.plan as Record<string, unknown> | undefined
    if (!p) return
    setMinStakeUsdCents(String(p.minStakeUsdCents ?? ''))
    setDailyRateBps(String(p.dailyRateBps ?? ''))
    setLevelCommissionBps(Array.isArray(p.levelCommissionBps) ? p.levelCommissionBps.join(', ') : '')
    setDirectReferralBonusBps(String(p.directReferralBonusBps ?? ''))
    setLockedPackages((p.lockedPackages as LockedPackageRow[]) ?? [])
    setRankRewards((p.rankRewards as RankRewardRow[]) ?? [])
  }, [settings.data])

  const save = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: async () => {
      toast.success('Plan settings saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'platform-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['platform', 'public'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

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

  if (settings.isLoading) return <LoadingState />
  if (settings.isError) {
    return <ErrorState message={settings.error.message} onRetry={() => settings.refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="Plan"
        description="Stake minimums, daily ROI rate, level commissions, locked packages, and rank rewards."
      />

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
            <Input
              value={directReferralBonusBps}
              onChange={(e) => setDirectReferralBonusBps(e.target.value)}
            />
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
  )
}
