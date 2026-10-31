import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Save, Trash2, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import {
  adminDeleteMiningBooster,
  adminGetBoosterStats,
  adminListMiningBoosters,
  adminSetBoosterPaymentWallet,
  adminUpsertMiningBooster,
  adminMiningDashboardStats,
} from '@/services/admin-service'

type Draft = {
  boosterId?: string
  name: string
  description: string
  bonusRatePerHour: string
  durationSeconds: string
  priceUsdt: string
  enabled: boolean
  sortOrder: string
}

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  bonusRatePerHour: '5',
  durationSeconds: '86400',
  priceUsdt: '10',
  enabled: true,
  sortOrder: '0',
})

export function AdminMiningBoostersPage() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [paymentWallet, setPaymentWallet] = useState('')

  const stats = useQuery({ queryKey: ['admin', 'boosters', 'stats'], queryFn: adminGetBoosterStats })
  const catalog = useQuery({
    queryKey: ['admin', 'boosters', 'catalog'],
    queryFn: () => adminListMiningBoosters(true),
  })
  const mining = useQuery({
    queryKey: ['admin', 'mining', 'dashboard'],
    queryFn: adminMiningDashboardStats,
  })

  useEffect(() => {
    const wallet = mining.data?.config.boosterPaymentWallet
    if (wallet) setPaymentWallet(wallet)
  }, [mining.data])

  const saveWallet = useMutation({
    mutationFn: () => adminSetBoosterPaymentWallet(paymentWallet),
    onSuccess: async () => {
      toast.success('Booster payment wallet saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'mining'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveBooster = useMutation({
    mutationFn: adminUpsertMiningBooster,
    onSuccess: async () => {
      toast.success(draft.boosterId ? 'Booster updated' : 'Booster created')
      setDraft(emptyDraft())
      await queryClient.invalidateQueries({ queryKey: ['admin', 'boosters'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removeBooster = useMutation({
    mutationFn: adminDeleteMiningBooster,
    onSuccess: async () => {
      toast.success('Booster deleted')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'boosters'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (catalog.isLoading || stats.isLoading) return <LoadingState />
  if (catalog.isError) {
    return <ErrorState message={catalog.error.message} onRetry={() => catalog.refetch()} />
  }

  const s = stats.data

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet mining"
        title="Boosters"
        description="Paid speed boosts. Users pay USDT (BEP-20) to your wallet; boost activates only after on-chain confirmation."
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining">Free mining settings</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters/active">Active boosters</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters/history">Booster history</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Active boosters', value: s?.activeBoosters ?? 0 },
          { label: 'Activated purchases', value: s?.activatedPurchases ?? 0 },
          { label: 'Awaiting payment', value: s?.awaitingPayment ?? 0 },
          { label: 'Revenue (USDT)', value: s?.totalRevenueUsdt ?? '0' },
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
          <CardTitle className="font-sans text-lg">USDT BEP-20 payment wallet</CardTitle>
          <CardDescription>
            All booster payments must be sent to this address. Boost activates only after the exact
            amount is confirmed on BSC.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-3">
          <div className="space-y-2">
            <Label>Receive wallet (0x…)</Label>
            <Input
              value={paymentWallet}
              onChange={(e) => setPaymentWallet(e.target.value.trim())}
              placeholder="0x…"
            />
          </div>
          <Button
            className="w-fit"
            disabled={saveWallet.isPending || paymentWallet.length < 42}
            onClick={() => saveWallet.mutate()}
          >
            <Save className="size-4" />
            Save payment wallet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-sans text-lg">
            <Zap className="size-5" />
            {draft.boosterId ? 'Edit booster' : 'Add booster'}
          </CardTitle>
          <CardDescription>
            Bonus speed is added on top of free mining speed for the booster duration after payment.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-3">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              placeholder="Turbo 2x"
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Bonus speed (VFXT / hour)</Label>
            <Input
              value={draft.bonusRatePerHour}
              onChange={(e) => setDraft((d) => ({ ...d, bonusRatePerHour: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Boost duration (seconds)</Label>
            <Input
              value={draft.durationSeconds}
              onChange={(e) => setDraft((d) => ({ ...d, durationSeconds: e.target.value }))}
              inputMode="numeric"
            />
            <p className="text-xs text-ink-muted">86400 = 24 hours</p>
          </div>
          <div className="space-y-2">
            <Label>Price (USDT BEP-20)</Label>
            <Input
              value={draft.priceUsdt}
              onChange={(e) => setDraft((d) => ({ ...d, priceUsdt: e.target.value }))}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label>Enabled</Label>
            <NativeSelect
              value={draft.enabled ? 'yes' : 'no'}
              onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.value === 'yes' }))}
            >
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label>Sort order</Label>
            <Input
              value={draft.sortOrder}
              onChange={(e) => setDraft((d) => ({ ...d, sortOrder: e.target.value }))}
              inputMode="numeric"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={saveBooster.isPending || !draft.name.trim()}
              onClick={() =>
                saveBooster.mutate({
                  boosterId: draft.boosterId,
                  name: draft.name,
                  description: draft.description,
                  bonusRatePerHour: draft.bonusRatePerHour,
                  durationSeconds: Number.parseInt(draft.durationSeconds, 10),
                  priceUsdt: draft.priceUsdt,
                  enabled: draft.enabled,
                  sortOrder: Number.parseInt(draft.sortOrder, 10) || 0,
                })
              }
            >
              <Plus className="size-4" />
              {draft.boosterId ? 'Update booster' : 'Create booster'}
            </Button>
            {draft.boosterId ? (
              <Button variant="secondary" onClick={() => setDraft(emptyDraft())}>
                Cancel edit
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Booster catalog</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(catalog.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">No boosters yet. Create one above.</p>
          ) : (
            catalog.data!.items.map((b) => (
              <div
                key={b.boosterId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {b.name}{' '}
                    <Badge variant={b.enabled ? 'secondary' : 'outline'}>
                      {b.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </p>
                  <p className="text-ink-muted">
                    +{b.bonusRatePerHour} VFXT/h · {Math.round(b.durationSeconds / 3600)}h ·{' '}
                    {b.priceUsdt} USDT (BEP-20)
                  </p>
                  {b.description ? (
                    <p className="text-xs text-ink-muted">{b.description}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      setDraft({
                        boosterId: b.boosterId,
                        name: b.name,
                        description: b.description,
                        bonusRatePerHour: b.bonusRatePerHour,
                        durationSeconds: String(b.durationSeconds),
                        priceUsdt: b.priceUsdt,
                        enabled: b.enabled,
                        sortOrder: String(b.sortOrder),
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={removeBooster.isPending}
                    onClick={() => {
                      if (!window.confirm(`Delete booster “${b.name}”?`)) return
                      removeBooster.mutate(b.boosterId)
                    }}
                  >
                    <Trash2 className="size-4" />
                    Delete
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
