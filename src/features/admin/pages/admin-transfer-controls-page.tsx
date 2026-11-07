import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowRightLeft, Plus, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { WALLET_META, type WalletKind } from '@/lib/plan'
import {
  getAdminTransferSettings,
  updateAdminTransferSettings,
  type PeerWalletSetting,
  type TransferRouteSetting,
  type WalletKindName,
} from '@/services/transfer-settings-service'

function label(kind: string) {
  return WALLET_META[kind as WalletKind]?.label ?? kind
}

export function AdminTransferControlsPage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['admin', 'transfer-settings'],
    queryFn: getAdminTransferSettings,
  })

  const [enabled, setEnabled] = useState(true)
  const [internalEnabled, setInternalEnabled] = useState(true)
  const [peerEnabled, setPeerEnabled] = useState(true)
  const [routes, setRoutes] = useState<TransferRouteSetting[]>([])
  const [peers, setPeers] = useState<PeerWalletSetting[]>([])
  const [walletKinds, setWalletKinds] = useState<WalletKindName[]>([])
  const [newFrom, setNewFrom] = useState<WalletKindName>('daily_roi')
  const [newTo, setNewTo] = useState<WalletKindName>('withdrawal')

  useEffect(() => {
    const s = query.data?.settings
    if (!s) return
    setEnabled(s.enabled)
    setInternalEnabled(s.internalEnabled)
    setPeerEnabled(s.peerEnabled)
    setRoutes(s.internalRoutes)
    setPeers(s.peerWallets)
    setWalletKinds(s.walletKinds)
  }, [query.data])

  const kinds = useMemo(
    () => (walletKinds.length ? walletKinds : (Object.keys(WALLET_META) as WalletKindName[])),
    [walletKinds],
  )

  const save = useMutation({
    mutationFn: () =>
      updateAdminTransferSettings({
        enabled,
        internalEnabled,
        peerEnabled,
        internalRoutes: routes,
        peerWallets: peers,
      }),
    onSuccess: async () => {
      toast.success('Transfer controls saved')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'transfer-settings'] })
      await queryClient.invalidateQueries({ queryKey: ['my-transfer-settings'] })
    },
    onError: (e: Error) => toast.error(e.message || 'Save failed'),
  })

  function addRoute() {
    if (newFrom === newTo) {
      toast.error('From and To wallets must be different')
      return
    }
    if (routes.some((r) => r.from === newFrom && r.to === newTo)) {
      toast.message('That route already exists')
      return
    }
    setRoutes((prev) => [...prev, { from: newFrom, to: newTo, enabled: true }])
  }

  if (query.isLoading) return <LoadingState label="Loading transfer controls…" />
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfer controls"
        description="Enable or disable wallet-to-wallet moves and peer transfers. Defaults match the current live rules."
        actions={
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-3.5" />
            Save
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium">All transfers</p>
            <p className="text-xs text-ink-muted">Master switch for every transfer</p>
          </div>
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Internal transfers</p>
            <p className="text-xs text-ink-muted">Same-user wallet → wallet</p>
          </div>
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={internalEnabled}
            onChange={(e) => setInternalEnabled(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Peer transfers</p>
            <p className="text-xs text-ink-muted">Send to another user ID</p>
          </div>
          <input
            type="checkbox"
            className="size-4 accent-accent"
            checked={peerEnabled}
            onChange={(e) => setPeerEnabled(e.target.checked)}
          />
        </label>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base flex items-center gap-2">
            <ArrowRightLeft className="size-4 text-accent" />
            Internal routes (same user)
          </CardTitle>
          <CardDescription>
            Toggle which wallet can move balance into another of your own wallets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {routes.map((route, index) => (
            <div
              key={`${route.from}:${route.to}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2.5"
            >
              <p className="text-sm font-medium">
                {label(route.from)} <span className="text-ink-muted">→</span> {label(route.to)}
              </p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    className="size-3.5 accent-accent"
                    checked={route.enabled}
                    onChange={(e) => {
                      const next = [...routes]
                      next[index] = { ...route, enabled: e.target.checked }
                      setRoutes(next)
                    }}
                  />
                  Enabled
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRoutes((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-border/80 p-3">
            <div className="space-y-1">
              <Label>From</Label>
              <select
                className="flex h-10 rounded-xl border border-border bg-background px-3 text-sm"
                value={newFrom}
                onChange={(e) => setNewFrom(e.target.value as WalletKindName)}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {label(k)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <select
                className="flex h-10 rounded-xl border border-border bg-background px-3 text-sm"
                value={newTo}
                onChange={(e) => setNewTo(e.target.value as WalletKindName)}
              >
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {label(k)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="button" variant="secondary" onClick={addRoute}>
              <Plus className="size-3.5" />
              Add route
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-base">Peer wallets (to another user)</CardTitle>
          <CardDescription>
            Choose which wallets members may send to another User ID (same wallet kind on both sides).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {peers.map((peer, index) => (
            <label
              key={peer.kind}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 px-3 py-2.5"
            >
              <span className="text-sm font-medium">{label(peer.kind)}</span>
              <input
                type="checkbox"
                className="size-4 accent-accent"
                checked={peer.enabled}
                onChange={(e) => {
                  const next = [...peers]
                  next[index] = { ...peer, enabled: e.target.checked }
                  setPeers(next)
                }}
              />
            </label>
          ))}
          {kinds
            .filter((k) => !peers.some((p) => p.kind === k))
            .map((kind) => (
              <Button
                key={kind}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPeers((prev) => [...prev, { kind, enabled: true }])}
              >
                <Plus className="size-3.5" />
                Add {label(kind)}
              </Button>
            ))}
        </CardContent>
      </Card>
    </div>
  )
}
