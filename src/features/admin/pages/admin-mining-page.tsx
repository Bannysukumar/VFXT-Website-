import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Pickaxe, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import {
  adminListMiningClaims,
  adminMiningDashboardStats,
  adminUpdateClaim,
  adminUpdateMiningConfig,
} from '@/services/admin-service'

export function AdminMiningPage() {
  const queryClient = useQueryClient()
  const dashboard = useQuery({
    queryKey: ['admin', 'mining', 'dashboard'],
    queryFn: adminMiningDashboardStats,
  })
  const claims = useQuery({
    queryKey: ['admin', 'mining', 'claims'],
    queryFn: () => adminListMiningClaims({ status: 'pending', limit: 50 }),
  })

  const [enabled, setEnabled] = useState(true)
  const [ratePerHour, setRatePerHour] = useState('10')
  const [durationSeconds, setDurationSeconds] = useState('3600')
  const [minimumClaim, setMinimumClaim] = useState('1')
  const [maximumReward, setMaximumReward] = useState('100')
  const [allowStop, setAllowStop] = useState(true)
  const [payoutMode, setPayoutMode] = useState<'admin_approved' | 'automatic'>('admin_approved')

  useEffect(() => {
    const cfg = dashboard.data?.config
    if (!cfg) return
    setEnabled(cfg.enabled)
    setRatePerHour(cfg.ratePerHour)
    setDurationSeconds(String(cfg.durationSeconds))
    setMinimumClaim(cfg.minimumClaim)
    setMaximumReward(cfg.maximumReward)
    setAllowStop(cfg.allowStop)
    setPayoutMode(cfg.payoutMode)
  }, [dashboard.data])

  const saveConfig = useMutation({
    mutationFn: adminUpdateMiningConfig,
    onSuccess: async () => {
      toast.success('Mining configuration saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mining'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const updateClaim = useMutation({
    mutationFn: adminUpdateClaim,
    onSuccess: async () => {
      toast.success('Claim updated')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mining'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (dashboard.isLoading) return <LoadingState />
  if (dashboard.isError) {
    return <ErrorState message={dashboard.error.message} onRetry={() => dashboard.refetch()} />
  }

  const stats = dashboard.data?.stats

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet"
        title="Mining & claims"
        description="Set free mining speed and session time. Paid boosters are managed separately and only activate after USDT BEP-20 payment confirms."
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters">Manage boosters</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters/active">
            Active boosters ({stats?.activeBoosters ?? 0})
          </Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters/history">Booster history</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active sessions', value: stats?.activeSessions ?? 0 },
          { label: 'Mining users', value: stats?.miningUsers ?? 0 },
          { label: 'Pending claims', value: stats?.pendingClaims ?? 0 },
          { label: 'Lifetime mined', value: `${stats?.totalLifetime ?? '0'} VFXT` },
          { label: 'Active boosters', value: stats?.activeBoosters ?? 0 },
          {
            label: 'Booster revenue',
            value: `${stats?.boosterRevenueUsdt ?? '0'} USDT`,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="pb-2">
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className="font-sans text-2xl">{item.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-sans text-lg">
            <Pickaxe className="size-5" />
            Free mining configuration
          </CardTitle>
          <CardDescription>
            Free speed and session time for every user. Paid boosters add bonus speed on top after
            USDT payment succeeds.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-4">
          <div className="space-y-2">
            <Label>Mining enabled</Label>
            <NativeSelect
              value={enabled ? 'yes' : 'no'}
              onChange={(e) => setEnabled(e.target.value === 'yes')}
            >
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Free mining speed (VFXT / hour)</Label>
            <Input value={ratePerHour} onChange={(e) => setRatePerHour(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Free session time (seconds)</Label>
            <Input
              value={durationSeconds}
              onChange={(e) => setDurationSeconds(e.target.value)}
              inputMode="numeric"
            />
            <p className="text-xs text-ink-muted">Example: 3600 = 1 hour</p>
          </div>
          <div className="space-y-2">
            <Label>Minimum claim (VFXT)</Label>
            <Input value={minimumClaim} onChange={(e) => setMinimumClaim(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Maximum reward per session (VFXT)</Label>
            <Input value={maximumReward} onChange={(e) => setMaximumReward(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Allow stop</Label>
            <NativeSelect
              value={allowStop ? 'yes' : 'no'}
              onChange={(e) => setAllowStop(e.target.value === 'yes')}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Payout mode</Label>
            <NativeSelect
              value={payoutMode}
              onChange={(e) =>
                setPayoutMode(e.target.value as 'admin_approved' | 'automatic')
              }
            >
              <option value="admin_approved">Admin approved</option>
              <option value="automatic">Automatic</option>
            </NativeSelect>
          </div>
          <Button
            className="w-fit"
            disabled={saveConfig.isPending}
            onClick={() =>
              saveConfig.mutate({
                enabled,
                ratePerHour,
                durationSeconds: Number.parseInt(durationSeconds, 10),
                minimumClaim,
                maximumReward,
                allowStop,
                payoutMode,
              })
            }
          >
            <Save className="size-4" />
            Save mining config
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Pending claims</CardTitle>
          <CardDescription>
            Approve or reject wallet mining claims. On-chain payouts are recorded via transaction
            hash when marked paid.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {claims.isLoading ? (
            <p className="text-sm text-ink-muted">Loading claims…</p>
          ) : (claims.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">No pending claims.</p>
          ) : (
            claims.data!.items.map((claim) => (
              <div
                key={claim.claimId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {claim.amount} VFXT{' '}
                    <Badge variant="secondary">{claim.status}</Badge>
                  </p>
                  <p className="font-mono text-xs text-ink-muted">{claim.destinationAddress}</p>
                  <p className="font-mono text-xs text-ink-muted">{claim.userId}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updateClaim.isPending}
                    onClick={() =>
                      updateClaim.mutate({ claimId: claim.claimId, status: 'approved' })
                    }
                  >
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={updateClaim.isPending}
                    onClick={() =>
                      updateClaim.mutate({
                        claimId: claim.claimId,
                        status: 'paid',
                      })
                    }
                  >
                    Mark paid
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={updateClaim.isPending}
                    onClick={() => {
                      const reason = window.prompt('Rejection reason') ?? ''
                      if (!reason.trim()) return
                      updateClaim.mutate({
                        claimId: claim.claimId,
                        status: 'rejected',
                        reason: reason.trim(),
                      })
                    }}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
