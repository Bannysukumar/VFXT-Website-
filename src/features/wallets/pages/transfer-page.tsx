import { useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  ArrowLeftRight,
  ArrowRight,
  Check,
  Copy,
  History,
  Loader2,
  UserRound,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { formatMinor, parseToMinor } from '@/lib/money'
import { WALLET_META, type WalletKind } from '@/lib/plan'
import { cn } from '@/lib/utils'
import {
  getAffiliateDashboard,
  lookupUserId,
  transferBetweenWallets,
  transferToUser,
} from '@/services/plan-service'
import { getMyTransferSettings } from '@/services/transfer-settings-service'
import { fetchUserWallets } from '@/services/wallet-service'
import { useAuth } from '@/features/auth/auth-context'

type Mode = 'peer' | 'internal'

const DEFAULT_INTERNAL_ROUTES: Array<{
  from: WalletKind
  to: WalletKind
  title: string
  hint: string
}> = [
  {
    from: 'daily_roi',
    to: 'withdrawal',
    title: 'Daily ROI → Withdrawal',
    hint: 'Move daily earnings so you can withdraw',
  },
  {
    from: 'level_income',
    to: 'withdrawal',
    title: 'Level income → Withdrawal',
    hint: 'Move affiliate commissions to withdrawal',
  },
  {
    from: 'direct_referral',
    to: 'withdrawal',
    title: 'Direct referral → Withdrawal',
    hint: 'Convert VFXT referral bonus to USD withdrawal',
  },
  {
    from: 'direct_referral',
    to: 'staking',
    title: 'Direct referral → Staking',
    hint: 'Convert VFXT referral bonus into staking balance',
  },
]

const DEFAULT_PEER_KINDS: WalletKind[] = ['fund', 'vfxt', 'withdrawal', 'direct_referral']

const internalSchema = z.object({
  route: z.string().min(1),
  amount: z.string().min(1, 'Enter an amount'),
})

const peerSchema = z.object({
  toUserId: z.string().min(4, 'Enter a user ID like VFXT2533'),
  walletKind: z.string().min(1),
  amount: z.string().min(1, 'Enter an amount'),
  note: z.string().max(200).optional(),
})

type InternalValues = z.infer<typeof internalSchema>
type PeerValues = z.infer<typeof peerSchema>

function walletAvailable(
  wallets: Array<{ id: string; kind?: string; availableMinor: number }> | undefined,
  kind: WalletKind,
): number {
  if (!wallets?.length) return 0
  const match =
    wallets.find((w) => w.kind === kind) ?? wallets.find((w) => w.id.endsWith(`_${kind}`))
  return match?.availableMinor ?? 0
}

function formatWalletBalance(kind: WalletKind, minor: number): string {
  const meta = WALLET_META[kind]
  if (meta.currency === 'VFXT') {
    return `${formatMinor(minor, { scale: 0 })} VFXT`
  }
  return formatMinor(minor, { scale: 2, currency: 'USD' })
}

function amountToInput(kind: WalletKind, minor: number): string {
  const scale = WALLET_META[kind].currency === 'VFXT' ? 0 : 2
  if (scale === 0) return String(Math.floor(minor))
  return (minor / 100).toFixed(2)
}

export function TransferPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [mode, setMode] = useState<Mode>('peer')
  const [copied, setCopied] = useState(false)
  const [lookupName, setLookupName] = useState<string | null>(null)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  const affiliate = useQuery({
    queryKey: ['affiliate', user?.uid],
    queryFn: getAffiliateDashboard,
    enabled: Boolean(user?.uid),
  })

  const wallets = useQuery({
    queryKey: ['wallets', user?.uid],
    queryFn: () => fetchUserWallets(user!.uid),
    enabled: Boolean(user?.uid),
  })

  const transferSettings = useQuery({
    queryKey: ['my-transfer-settings'],
    queryFn: getMyTransferSettings,
    staleTime: 30_000,
  })

  const internalRoutes = useMemo(() => {
    const live = transferSettings.data?.internalRoutes
    if (!live?.length) return DEFAULT_INTERNAL_ROUTES
    return live.map((r) => {
      const fallback = DEFAULT_INTERNAL_ROUTES.find((d) => d.from === r.from && d.to === r.to)
      return {
        from: r.from as WalletKind,
        to: r.to as WalletKind,
        title: fallback?.title ?? `${WALLET_META[r.from as WalletKind]?.label ?? r.from} → ${WALLET_META[r.to as WalletKind]?.label ?? r.to}`,
        hint: fallback?.hint ?? 'Move balance between your wallets',
      }
    })
  }, [transferSettings.data])

  const peerWallets = useMemo(() => {
    const kinds = (transferSettings.data?.peerWallets?.length
      ? transferSettings.data.peerWallets
      : DEFAULT_PEER_KINDS) as WalletKind[]
    return kinds.map((kind) => ({
      kind,
      title: WALLET_META[kind]?.label ?? kind,
      hint: `Send VFXT from your ${WALLET_META[kind]?.label ?? kind} to another member`,
    }))
  }, [transferSettings.data])

  const transfersMasterOn = transferSettings.data?.enabled !== false
  const peerAllowed = transfersMasterOn && transferSettings.data?.peerEnabled !== false
  const internalAllowed = transfersMasterOn && transferSettings.data?.internalEnabled !== false

  const internalForm = useForm<InternalValues>({
    resolver: zodResolver(internalSchema),
    defaultValues: { route: 'daily_roi:withdrawal', amount: '' },
  })

  const peerForm = useForm<PeerValues>({
    resolver: zodResolver(peerSchema),
    defaultValues: { toUserId: '', walletKind: 'fund', amount: '', note: '' },
  })

  useEffect(() => {
    if (!internalRoutes.length) return
    const current = internalForm.getValues('route')
    if (!internalRoutes.some((r) => `${r.from}:${r.to}` === current)) {
      internalForm.setValue('route', `${internalRoutes[0]!.from}:${internalRoutes[0]!.to}`)
    }
  }, [internalRoutes, internalForm])

  useEffect(() => {
    if (!peerWallets.length) return
    const current = peerForm.getValues('walletKind')
    if (!peerWallets.some((w) => w.kind === current)) {
      peerForm.setValue('walletKind', peerWallets[0]!.kind)
    }
  }, [peerWallets, peerForm])

  const peerWalletKind = peerForm.watch('walletKind') as WalletKind
  const peerUserId = peerForm.watch('toUserId')
  const peerAmount = peerForm.watch('amount')
  const internalRoute = internalForm.watch('route')
  const internalAmount = internalForm.watch('amount')

  const selectedInternal = useMemo(
    () => internalRoutes.find((r) => `${r.from}:${r.to}` === internalRoute) ?? internalRoutes[0],
    [internalRoute, internalRoutes],
  )

  const peerBalance = walletAvailable(wallets.data, peerWalletKind)
  const internalFromBalance = selectedInternal
    ? walletAvailable(wallets.data, selectedInternal.from)
    : 0

  useEffect(() => {
    const raw = peerUserId.trim().toUpperCase()
    if (raw.length < 4) {
      setLookupName(null)
      setLookupError(null)
      return
    }
    if (affiliate.data?.referralCode && raw === affiliate.data.referralCode.toUpperCase()) {
      setLookupName(null)
      setLookupError('That is your own User ID')
      return
    }

    let cancelled = false
    const timer = window.setTimeout(async () => {
      setLookingUp(true)
      setLookupError(null)
      try {
        const res = await lookupUserId(raw)
        if (cancelled) return
        setLookupName(res.displayName?.trim() || 'Member found')
        setLookupError(null)
      } catch (err) {
        if (cancelled) return
        setLookupName(null)
        setLookupError(err instanceof Error ? err.message : 'User not found')
      } finally {
        if (!cancelled) setLookingUp(false)
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [peerUserId, affiliate.data?.referralCode])

  const internalMutation = useMutation({
    mutationFn: async (values: InternalValues) => {
      if (!internalAllowed) throw new Error('Internal wallet transfers are disabled')
      const [fromKind, toKind] = values.route.split(':') as [WalletKind, WalletKind]
      const scale = WALLET_META[fromKind].currency === 'VFXT' ? 0 : 2
      const amountMinor = Number(parseToMinor(values.amount, scale))
      if (amountMinor <= 0) throw new Error('Amount must be positive')
      const available = walletAvailable(wallets.data, fromKind)
      if (amountMinor > available) throw new Error('Not enough balance in the source wallet')
      return transferBetweenWallets({
        fromKind,
        toKind,
        amountMinor,
        idempotencyKey: crypto.randomUUID(),
      })
    },
    onSuccess: async () => {
      toast.success('Moved to your wallet')
      internalForm.reset({ route: internalForm.getValues('route'), amount: '' })
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
      await queryClient.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const peerMutation = useMutation({
    mutationFn: async (values: PeerValues) => {
      const toUserId = values.toUserId.trim().toUpperCase()
      if (affiliate.data?.referralCode && toUserId === affiliate.data.referralCode.toUpperCase()) {
        throw new Error('Cannot transfer to yourself')
      }
      await lookupUserId(toUserId)
      if (!peerAllowed) throw new Error('Peer transfers are disabled')
      const kind = values.walletKind as WalletKind
      const scale = WALLET_META[kind].currency === 'VFXT' ? 0 : 2
      const amountMinor = Number(parseToMinor(values.amount, scale))
      if (amountMinor <= 0) throw new Error('Amount must be positive')
      const available = walletAvailable(wallets.data, kind)
      if (amountMinor > available) throw new Error('Not enough balance in that wallet')
      const note = values.note?.trim()
      return transferToUser({
        toUserId,
        walletKind: kind,
        amountMinor,
        ...(note ? { note } : {}),
        idempotencyKey: crypto.randomUUID(),
      })
    },
    onSuccess: async (res) => {
      toast.success(`Sent to ${res.toUserId}`)
      peerForm.reset({
        toUserId: '',
        walletKind: peerForm.getValues('walletKind'),
        amount: '',
        note: '',
      })
      setLookupName(null)
      setLookupError(null)
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
      await queryClient.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const myId = affiliate.data?.referralCode

  async function copyMyId() {
    if (!myId) return
    try {
      await navigator.clipboard.writeText(myId)
      setCopied(true)
      toast.success('User ID copied')
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      toast.error('Could not copy')
    }
  }

  function peerExceeds(): boolean {
    try {
      const scale = WALLET_META[peerWalletKind].currency === 'VFXT' ? 0 : 2
      const minor = Number(parseToMinor(peerAmount || '0', scale))
      return minor > peerBalance
    } catch {
      return false
    }
  }

  function internalExceeds(): boolean {
    try {
      if (!selectedInternal) return false
      const scale = WALLET_META[selectedInternal.from].currency === 'VFXT' ? 0 : 2
      const minor = Number(parseToMinor(internalAmount || '0', scale))
      return minor > internalFromBalance
    } catch {
      return false
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Transfer"
          description="Send money to another member, or move earnings between your own wallets."
        />
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/transfers/history">
            <History className="size-4" />
            History
          </Link>
        </Button>
      </div>

      {myId ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-panel px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm text-ink-muted">Your User ID</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide">{myId}</p>
            <p className="mt-1 text-xs text-ink-muted">
              Share this so others can send Fund, VFXT, or Withdrawal balances to you.
            </p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={copyMyId}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="Transfer type"
        className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-canvas p-1.5"
      >
        {(
          [
            { id: 'peer' as const, label: 'Send to someone', icon: UserRound },
            { id: 'internal' as const, label: 'Move my money', icon: ArrowLeftRight },
          ] as const
        ).map((tab) => {
          const active = mode === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setMode(tab.id)}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold transition-[background-color,color,box-shadow]',
                active
                  ? 'bg-panel text-ink shadow-sm ring-1 ring-line'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {!transfersMasterOn ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Transfers are temporarily disabled by admin.
        </p>
      ) : null}
      {transfersMasterOn && mode === 'peer' && !peerAllowed ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Peer transfers to other users are disabled.
        </p>
      ) : null}
      {transfersMasterOn && mode === 'internal' && !internalAllowed ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Internal wallet transfers are disabled.
        </p>
      ) : null}

      {mode === 'peer' ? (
        <Card>
          <CardHeader>
            <CardTitle>Send to a member</CardTitle>
            <CardDescription>
              Enter their User ID (example VFXT2533), pick what to send, then confirm the amount.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={peerForm.handleSubmit((v) => peerMutation.mutate(v))}
            >
              <div className="space-y-2">
                <Label htmlFor="toUserId">Recipient User ID</Label>
                <Input
                  id="toUserId"
                  placeholder="VFXT2533"
                  autoComplete="off"
                  className="h-12 font-mono text-base uppercase tracking-wide"
                  aria-invalid={Boolean(peerForm.formState.errors.toUserId) || Boolean(lookupError)}
                  {...peerForm.register('toUserId')}
                />
                <FieldError message={peerForm.formState.errors.toUserId?.message} />
                {lookingUp ? (
                  <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                    <Loader2 className="size-3.5 animate-spin" />
                    Checking user…
                  </p>
                ) : null}
                {!lookingUp && lookupName ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                    <Check className="size-3.5" />
                    {lookupName}
                  </p>
                ) : null}
                {!lookingUp && lookupError ? (
                  <p className="text-xs font-medium text-danger">{lookupError}</p>
                ) : null}
              </div>

              <div className="space-y-3">
                <Label>What do you want to send?</Label>
                <div className="grid gap-3 sm:grid-cols-3">
                  {peerWallets.map((option) => {
                    const active = peerWalletKind === option.kind
                    const bal = walletAvailable(wallets.data, option.kind)
                    return (
                      <button
                        key={option.kind}
                        type="button"
                        onClick={() =>
                          peerForm.setValue('walletKind', option.kind, { shouldValidate: true })
                        }
                        className={cn(
                          'rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow]',
                          active
                            ? 'border-accent bg-accent-soft/40 shadow-sm ring-1 ring-accent/30'
                            : 'border-line bg-panel hover:border-line-strong',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold">{option.title}</p>
                          {active ? <Badge variant="secondary">Selected</Badge> : null}
                        </div>
                        <p className="mt-1 text-sm text-ink-muted">{option.hint}</p>
                        <p className="mt-3 flex items-center gap-1.5 text-sm font-medium">
                          <Wallet className="size-3.5 text-ink-muted" />
                          Available {formatWalletBalance(option.kind, bal)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="peer-amount">Amount</Label>
                <div className="relative">
                  <Input
                    id="peer-amount"
                    inputMode="decimal"
                    placeholder={
                      WALLET_META[peerWalletKind].currency === 'VFXT' ? '0' : '0.00'
                    }
                    autoComplete="off"
                    className="tabular h-14 pr-24 text-xl font-semibold"
                    aria-invalid={Boolean(peerForm.formState.errors.amount) || peerExceeds()}
                    {...peerForm.register('amount')}
                  />
                  <button
                    type="button"
                    disabled={peerBalance <= 0}
                    onClick={() =>
                      peerForm.setValue('amount', amountToInput(peerWalletKind, peerBalance), {
                        shouldValidate: true,
                      })
                    }
                    className="absolute inset-y-2.5 right-2.5 rounded-lg bg-accent-soft px-3 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
                <FieldError message={peerForm.formState.errors.amount?.message} />
                <p className="text-xs text-ink-muted">
                  Enter whole VFXT tokens from {WALLET_META[peerWalletKind].label}
                </p>
                {peerExceeds() ? (
                  <p className="text-xs font-medium text-warning">
                    Amount is higher than your available balance.
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">Note (optional)</Label>
                <Input
                  id="note"
                  maxLength={200}
                  placeholder="What is this for?"
                  {...peerForm.register('note')}
                />
              </div>

              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={peerMutation.isPending || Boolean(lookupError) || !peerAllowed || peerWallets.length === 0}
              >
                {peerMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send now
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Move between your wallets</CardTitle>
            <CardDescription>
              Shift earnings into Withdrawal before you cash out. Staking still starts from the
              Staking page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-6"
              onSubmit={internalForm.handleSubmit((v) => internalMutation.mutate(v))}
            >
              <div className="space-y-3">
                <Label>Choose a move</Label>
                <div className="grid gap-3">
                  {internalRoutes.map((route) => {
                    const value = `${route.from}:${route.to}`
                    const active = internalRoute === value
                    const fromBal = walletAvailable(wallets.data, route.from)
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() =>
                          internalForm.setValue('route', value, { shouldValidate: true })
                        }
                        className={cn(
                          'rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow]',
                          active
                            ? 'border-accent bg-accent-soft/40 shadow-sm ring-1 ring-accent/30'
                            : 'border-line bg-panel hover:border-line-strong',
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold">{route.title}</p>
                            <p className="mt-1 text-sm text-ink-muted">{route.hint}</p>
                          </div>
                          {active ? <Badge variant="secondary">Selected</Badge> : null}
                        </div>
                        <p className="mt-3 text-sm font-medium">
                          Available {formatWalletBalance(route.from, fromBal)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder={
                      selectedInternal && WALLET_META[selectedInternal.from].currency === 'VFXT'
                        ? '0'
                        : '0.00'
                    }
                    autoComplete="off"
                    className="tabular h-14 pr-24 text-xl font-semibold"
                    aria-invalid={
                      Boolean(internalForm.formState.errors.amount) || internalExceeds()
                    }
                    {...internalForm.register('amount')}
                  />
                  <button
                    type="button"
                    disabled={internalFromBalance <= 0 || !selectedInternal}
                    onClick={() =>
                      selectedInternal &&
                      internalForm.setValue(
                        'amount',
                        amountToInput(selectedInternal.from, internalFromBalance),
                        { shouldValidate: true },
                      )
                    }
                    className="absolute inset-y-2.5 right-2.5 rounded-lg bg-accent-soft px-3 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
                <FieldError message={internalForm.formState.errors.amount?.message} />
                {internalExceeds() ? (
                  <p className="text-xs font-medium text-warning">
                    Amount is higher than your available balance.
                  </p>
                ) : null}
              </div>

              {selectedInternal ? (
                <div className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink-muted">
                  Moving from{' '}
                  <span className="font-medium text-ink">
                    {WALLET_META[selectedInternal.from].label}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium text-ink">
                    {WALLET_META[selectedInternal.to].label}
                  </span>
                  .
                </div>
              ) : null}

              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={
                  internalMutation.isPending || !internalAllowed || internalRoutes.length === 0
                }
              >
                {internalMutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Moving…
                  </>
                ) : (
                  <>
                    Move now
                    <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
