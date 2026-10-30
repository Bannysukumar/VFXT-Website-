import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { getAdminPlatformSettings, updatePlatformSettings } from '@/services/admin-service'

export function AdminWithdrawSettingsPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({
    queryKey: ['admin', 'platform-settings'],
    queryFn: getAdminPlatformSettings,
  })

  const [minWithdrawUsdCents, setMinWithdrawUsdCents] = useState('')
  const [commissionBps, setCommissionBps] = useState('')
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState(false)
  const [requireProfileAddress, setRequireProfileAddress] = useState(true)

  useEffect(() => {
    const w = settings.data?.withdraw as Record<string, unknown> | undefined
    if (!w) return
    setMinWithdrawUsdCents(String(w.minWithdrawUsdCents ?? ''))
    setCommissionBps(String(w.commissionBps ?? 0))
    setAutoWithdrawEnabled(Boolean(w.autoWithdrawEnabled))
    setRequireProfileAddress(w.requireProfileAddress !== false)
  }, [settings.data])

  const save = useMutation({
    mutationFn: updatePlatformSettings,
    onSuccess: async () => {
      toast.success('Withdraw settings saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'platform-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['platform', 'public'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const saveWithdraw = () =>
    save.mutate({
      withdraw: {
        minWithdrawUsdCents: Number.parseInt(minWithdrawUsdCents, 10),
        commissionBps: Number.parseInt(commissionBps, 10),
        autoWithdrawEnabled,
        requireProfileAddress,
      },
    })

  if (settings.isLoading) return <LoadingState />
  if (settings.isError) {
    return <ErrorState message={settings.error.message} onRetry={() => settings.refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="Withdraw"
        description="Minimum amount, commission fee, auto-withdraw after first payout, and address rules."
      />

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Withdraw settings</CardTitle>
          <CardDescription>
            After a member’s first withdrawal, their wallet is linked. When auto-withdraw is on and
            the withdrawal wallet reaches the minimum, payouts run automatically to that unique
            address.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4">
          <div className="space-y-2">
            <Label>Min withdraw (USD cents)</Label>
            <Input
              value={minWithdrawUsdCents}
              onChange={(e) => setMinWithdrawUsdCents(e.target.value)}
            />
            <p className="text-xs text-ink-muted">
              ${(Number(minWithdrawUsdCents || 0) / 100).toFixed(2)} minimum
            </p>
          </div>
          <div className="space-y-2">
            <Label>Withdrawal commission (basis points)</Label>
            <Input
              value={commissionBps}
              onChange={(e) => setCommissionBps(e.target.value)}
              placeholder="500 = 5%"
            />
            <p className="text-xs text-ink-muted">
              {(Number(commissionBps || 0) / 100).toFixed(2)}% fee — user is debited full amount; net
              USDT is sent on-chain.
            </p>
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
            <p className="text-xs text-ink-muted">
              When Yes: after the first successful withdrawal, any time the withdrawal wallet is at
              or above the minimum, the system auto-sends to the linked wallet (every ~5 minutes).
            </p>
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
    </div>
  )
}
