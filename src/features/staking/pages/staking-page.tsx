import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { formatMinor, parseToMinor } from '@/lib/money'
import {
  DAILY_YIELD,
  LOCKED_PACKAGES,
  MIN_STAKE_USD_CENTS,
  usdCentsToVfxtTokens,
} from '@/lib/plan'
import {
  createStakingPosition,
  getMyStakingPositions,
  type StakingPlanId,
} from '@/services/plan-service'

const schema = z.object({
  planId: z.enum(['daily_yield', 'locked_300', 'locked_500', 'locked_700']),
  amount: z.string().min(1),
})

type Values = z.infer<typeof schema>

export function StakingPage() {
  const queryClient = useQueryClient()
  const positionsQuery = useQuery({
    queryKey: ['staking', 'positions'],
    queryFn: getMyStakingPositions,
  })

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { planId: 'daily_yield', amount: '100' },
  })

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const amountMinor = Number(parseToMinor(values.amount, 2))
      if (amountMinor < MIN_STAKE_USD_CENTS) {
        throw new Error('Minimum stake is $100')
      }
      return createStakingPosition({
        planId: values.planId as StakingPlanId,
        amountMinor,
        idempotencyKey: crypto.randomUUID(),
      })
    },
    onSuccess: async () => {
      toast.success('Staking position created')
      form.reset({ planId: form.getValues('planId'), amount: '100' })
      await queryClient.invalidateQueries({ queryKey: ['staking'] })
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">Staking</h1>
        <p className="mt-1 text-ink-muted">
          Stake from your Fund Wallet. Daily yield pays 1% for up to 200 days (2X / 3X caps).
          Time-locked packages pay multiplier + bonus VFXT at maturity.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <Badge variant="success">Regular daily yield</Badge>
            <CardTitle className="font-sans text-xl">1% daily · 200 days</CardTitle>
            <CardDescription>
              Min $100 · Cap {DAILY_YIELD.nonWorkingCapX}X non-working / {DAILY_YIELD.workingCapX}X
              working (needs ≥1 direct referral). Credits Daily ROI Wallet.
            </CardDescription>
          </CardHeader>
        </Card>
        {LOCKED_PACKAGES.map((pkg) => (
          <Card key={pkg.id}>
            <CardHeader>
              <Badge variant="secondary">{pkg.days} days</Badge>
              <CardTitle className="font-sans text-xl">
                {pkg.multiplier}X + {pkg.bonusTokenPct}% VFXT
              </CardTitle>
              <CardDescription>
                Lock capital for {pkg.days} days. Example $100 → ~{usdCentsToVfxtTokens(10000)} VFXT
                principal basis with +{pkg.bonusTokenPct}% bonus tokens at maturity.
              </CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Open a position</CardTitle>
          <CardDescription>Debits Fund Wallet via Cloud Functions (idempotent).</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 sm:grid-cols-3"
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          >
            <div className="space-y-2 sm:col-span-1">
              <Label htmlFor="planId">Plan</Label>
              <select
                id="planId"
                className="flex h-10 w-full rounded-md border border-line bg-panel px-3 text-sm"
                {...form.register('planId')}
              >
                <option value="daily_yield">Daily yield 1%</option>
                {LOCKED_PACKAGES.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input id="amount" inputMode="decimal" {...form.register('amount')} />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={mutation.isPending} className="w-full">
                {mutation.isPending ? 'Staking…' : 'Stake now'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Your positions</CardTitle>
        </CardHeader>
        <CardContent>
          {positionsQuery.isLoading ? <LoadingState /> : null}
          {positionsQuery.isError ? (
            <ErrorState
              message={positionsQuery.error.message}
              onRetry={() => positionsQuery.refetch()}
            />
          ) : null}
          {(positionsQuery.data?.positions ?? []).length === 0 ? (
            <p className="text-sm text-ink-muted">No positions yet.</p>
          ) : (
            <div className="space-y-3">
              {positionsQuery.data!.positions.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3 text-sm last:border-0"
                >
                  <div>
                    <p className="font-medium">{p.planId.replaceAll('_', ' ')}</p>
                    <p className="text-xs text-ink-muted">
                      {p.createdAt ? format(new Date(p.createdAt), 'PPp') : '—'} · days paid{' '}
                      {p.daysPaid}
                      {p.workingAccount ? ' · working' : ' · non-working'}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{p.status}</Badge>
                    <p className="mt-1 font-medium">
                      {formatMinor(p.principalMinor, { scale: 2, currency: 'USD' })}
                    </p>
                    <p className="text-xs text-ink-muted">
                      Paid {formatMinor(p.totalPaidMinor, { scale: 2, currency: 'USD' })} / cap{' '}
                      {formatMinor(p.capMinor, { scale: 2, currency: 'USD' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
