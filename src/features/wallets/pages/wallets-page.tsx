import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor } from '@/lib/money'
import { WALLET_META, type WalletKind } from '@/lib/plan'
import { fetchUserWallets } from '@/services/wallet-service'
import { ensureWallets } from '@/services/plan-service'
import { Link } from 'react-router-dom'

function kindFromWallet(wallet: { id: string; currency: string; kind?: string }): WalletKind | null {
  if (wallet.kind && wallet.kind in WALLET_META) return wallet.kind as WalletKind
  const suffix = wallet.id.split('_').slice(1).join('_')
  if (suffix in WALLET_META) return suffix as WalletKind
  if (wallet.currency === 'USD') return 'fund'
  if (wallet.currency === 'VFXT') return 'vfxt'
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
      if (res.created.length) toast.success(`Provisioned: ${res.created.join(', ')}`)
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Wallets</h1>
          <p className="text-ink-muted">
            Fund, staking, daily ROI, level income, direct referral, withdrawal, and VFXT.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link to="/app/transfer" className="no-underline">
              Transfer
            </Link>
          </Button>
          <Button variant="outline" onClick={() => ensure.mutate()} disabled={ensure.isPending}>
            Sync wallets
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(Object.keys(WALLET_META) as WalletKind[]).map((kind) => {
          const meta = WALLET_META[kind]
          const wallet =
            wallets.find((w) => kindFromWallet(w) === kind) ??
            wallets.find((w) => w.id.endsWith(`_${kind}`))
          const scale = wallet?.scale ?? (meta.currency === 'VFXT' ? 0 : 2)
          return (
            <Card key={kind}>
              <CardHeader>
                <CardDescription>{meta.label}</CardDescription>
                <CardTitle className="font-sans text-2xl">
                  {wallet
                    ? formatMinor(wallet.availableMinor, {
                        scale,
                        currency: meta.currency === 'USD' ? 'USD' : undefined,
                      })
                    : '—'}
                  {meta.currency === 'VFXT' && wallet ? ' VFXT' : ''}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-ink-muted">
                <p>{meta.description}</p>
                {wallet ? (
                  <p>
                    Reserved{' '}
                    {formatMinor(wallet.reservedMinor, {
                      scale,
                      currency: meta.currency === 'USD' ? 'USD' : undefined,
                    })}
                  </p>
                ) : (
                  <p>Not provisioned yet — tap Sync wallets.</p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
