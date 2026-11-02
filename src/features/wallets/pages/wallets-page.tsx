import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Banknote,
  ChevronRight,
  Coins,
  Gift,
  Landmark,
  LineChart,
  Network,
  PiggyBank,
  RefreshCw,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor } from '@/lib/money'
import { WALLET_META, type WalletKind } from '@/lib/plan'
import { cn } from '@/lib/utils'
import { fetchUserWallets } from '@/services/wallet-service'
import { ensureWallets } from '@/services/plan-service'

const WALLET_ICONS: Record<WalletKind, typeof Wallet> = {
  fund: Landmark,
  staking: PiggyBank,
  daily_roi: LineChart,
  level_income: Network,
  direct_referral: Gift,
  withdrawal: Banknote,
  vfxt: Coins,
}

const WALLET_HINTS: Record<WalletKind, string> = {
  fund: 'Deposit here, then stake from Staking',
  staking: 'Principal locked in active plans',
  daily_roi: 'Move to Withdrawal when you want to cash out',
  level_income: 'Affiliate earnings — move to Withdrawal to cash out',
  direct_referral: 'VFXT bonus — transfer to Withdrawal or Staking',
  withdrawal: 'Ready to withdraw as USDT (BEP-20)',
  vfxt: 'Utility tokens — send to members or hold',
}

function kindFromWallet(wallet: { id: string; currency: string; kind?: string }): WalletKind | null {
  if (wallet.kind && wallet.kind in WALLET_META) return wallet.kind as WalletKind
  const suffix = wallet.id.split('_').slice(1).join('_')
  if (suffix in WALLET_META) return suffix as WalletKind
  if (wallet.currency === 'VFXT' && suffix === 'vfxt') return 'vfxt'
  if (wallet.currency === 'USD') return 'fund'
  return null
}

export function WalletsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: ['wallets', user?.uid],
    queryFn: () => fetchUserWallets(user!.uid),
    enabled: Boolean(user?.uid),
  })

  const ensure = useMutation({
    mutationFn: ensureWallets,
    onSuccess: async (res) => {
      if (res.created.length) toast.success(`Ready: ${res.created.join(', ')}`)
      else toast.message('Wallets already synced')
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  useEffect(() => {
    if (query.isSuccess && (query.data?.length ?? 0) < 7) {
      ensure.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.isSuccess, query.data?.length])

  if (query.isLoading) return <LoadingState />
  if (query.isError) {
    return <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
  }

  const wallets = query.data ?? []

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Wallets"
          description="See every balance in one place. Tap a wallet for its history, or use Deposit, Transfer, and Withdraw below."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => ensure.mutate()}
          disabled={ensure.isPending}
        >
          <RefreshCw className={cn('size-4', ensure.isPending && 'animate-spin')} />
          Sync
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        {[
          { to: '/app/deposits', label: 'Deposit', icon: ArrowDownToLine },
          { to: '/app/transfer', label: 'Transfer', icon: ArrowRightLeft },
          { to: '/app/withdrawals', label: 'Withdraw', icon: ArrowUpFromLine },
        ].map(({ to, label, icon: Icon }) => (
          <Button key={to} variant="secondary" asChild className="justify-center">
            <Link to={to} className="no-underline">
              <Icon className="size-4" />
              {label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(WALLET_META) as WalletKind[]).map((kind) => {
          const meta = WALLET_META[kind]
          const Icon = WALLET_ICONS[kind]
          const wallet =
            wallets.find((w) => kindFromWallet(w) === kind) ??
            wallets.find((w) => w.id.endsWith(`_${kind}`))
          const scale = wallet?.scale ?? (meta.currency === 'VFXT' ? 0 : 2)
          const available = wallet
            ? meta.currency === 'VFXT'
              ? `${formatMinor(wallet.availableMinor, { scale: 0 })} VFXT`
              : formatMinor(wallet.availableMinor, { scale, currency: 'USD' })
            : '—'

          return (
            <Link
              key={kind}
              to={`/app/wallets/${kind}/history`}
              className="group block no-underline outline-none"
            >
              <Card className="h-full transition-[border-color,background-color,box-shadow] group-hover:border-accent/40 group-hover:bg-panel-elevated group-hover:shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-accent">
                <CardContent className="flex h-full flex-col gap-4 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-accent">
                      <Icon className="size-5" />
                    </span>
                    <ChevronRight className="size-4 text-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{meta.label}</p>
                      <Badge variant="secondary">{meta.currency}</Badge>
                    </div>
                    <p className="mt-2 tabular text-2xl font-bold tracking-tight">{available}</p>
                    <p className="mt-2 text-sm text-ink-muted">{WALLET_HINTS[kind]}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-ink-muted">
                    <span>
                      {wallet
                        ? wallet.reservedMinor > 0
                          ? `On hold ${
                              meta.currency === 'VFXT'
                                ? `${formatMinor(wallet.reservedMinor, { scale: 0 })} VFXT`
                                : formatMinor(wallet.reservedMinor, { scale, currency: 'USD' })
                            }`
                          : 'Ready to use'
                        : 'Not ready yet — tap Sync'}
                    </span>
                    <span className="font-medium text-accent">History</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
