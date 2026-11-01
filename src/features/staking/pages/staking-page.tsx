import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { format } from 'date-fns'
import { CalendarDays, CheckCircle2, Coins, Percent, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { AmountInputPrefix, ProcessSteps, SummaryRow } from '@/components/shared/process-steps'
import { SuccessReceipt } from '@/components/shared/success-receipt'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor, parseToMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { images } from '@/lib/media'
import {
  DAILY_YIELD,
  LOCKED_PACKAGES,
  MIN_STAKE_USD_CENTS,
  dailyYieldCents,
  payoutCapCents,
  usdCentsToVfxtTokens,
} from '@/lib/plan'
import { fetchUserWallets } from '@/services/wallet-service'
import {
  createStakingPosition,
  getMyStakingPositions,
  type StakingPlanId,
} from '@/services/plan-service'

const schema = z.object({
  planId: z.enum(['daily_yield', 'locked_300', 'locked_500', 'locked_700']),
  amount: z.string().min(1, 'Enter an amount'),
})

type Values = z.infer<typeof schema>

type PlanOption = {
  id: StakingPlanId
  title: string
  badge: string
  headline: string
  points: string[]
  kind: 'daily' | 'locked'
  days?: number
  multiplier?: number
  bonusTokenPct?: number
}

const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'daily_yield',
    title: 'Daily income',
    badge: 'Most popular',
    headline: 'Get paid every day',
    points: [
      'About 1% of your stake is credited every 24 hours from your stake time',
      'Example: stake at 10:00 AM IST → first ROI at 10:00 AM IST the next day',
      `Keeps paying for up to ${DAILY_YIELD.maxDays} days`,
      `Stops at ${DAILY_YIELD.nonWorkingCapX}× your stake (or ${DAILY_YIELD.workingCapX}× if you have at least 1 direct referral)`,
      'Earnings go to your Daily ROI Wallet',
    ],
    kind: 'daily',
  },
  ...LOCKED_PACKAGES.map((pkg) => ({
    id: pkg.id,
    title: `${pkg.days}-day lock`,
    badge: `${pkg.multiplier}× return`,
    headline: `Lock now, unlock bigger later`,
    points: [
      `Your money stays locked for ${pkg.days} days`,
      `At the end you receive about ${pkg.multiplier}× your stake in USD value`,
      `Plus ${pkg.bonusTokenPct}% bonus VFXT tokens`,
      'Best if you can wait for the full term',
    ],
    kind: 'locked' as const,
    days: pkg.days,
    multiplier: pkg.multiplier,
    bonusTokenPct: pkg.bonusTokenPct,
  })),
]

const PLAN_LABELS: Record<StakingPlanId, string> = {
  daily_yield: 'Daily income',
  locked_300: '300-day lock',
  locked_500: '500-day lock',
  locked_700: '700-day lock',
}

const HOW_TO_STAKE = [
  {
    title: 'Add money to Fund Wallet',
    body: 'Deposit USDT first. Staking always spends from your Fund Wallet.',
  },
  {
    title: 'Pick a plan',
    body: 'Choose daily income for regular payouts, or a lock plan for a larger payout later.',
  },
  {
    title: 'Enter amount and stake',
    body: `Type how much to stake (minimum $${(MIN_STAKE_USD_CENTS / 100).toFixed(0)}) and confirm. Your position appears below right away.`,
  },
]

function previewMinor(input: string) {
  try {
    return input ? Number(parseToMinor(input, 2)) : 0
  } catch {
    return 0
  }
}

function formatStakingDate(value: unknown): string {
  if (!value) return '—'
  let ms: number | null = null
  if (typeof value === 'string' || typeof value === 'number') {
    ms = new Date(value).getTime()
  } else if (typeof value === 'object' && value !== null) {
    const v = value as { _seconds?: number; seconds?: number; toMillis?: () => number }
    if (typeof v.toMillis === 'function') ms = v.toMillis()
    else if (typeof v._seconds === 'number') ms = v._seconds * 1000
    else if (typeof v.seconds === 'number') ms = v.seconds * 1000
  }
  if (ms == null || Number.isNaN(ms)) return '—'
  try {
    return format(new Date(ms), 'PPp')
  } catch {
    return '—'
  }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    active: 'Earning',
    completed: 'Finished',
    matured: 'Matured',
    cancelled: 'Cancelled',
  }
  return map[status] ?? status
}

type StakeSuccess = {
  positionId: string
  planId: StakingPlanId
  amountMinor: number
}

export function StakingPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const previewSuccess = import.meta.env.DEV && searchParams.get('previewSuccess') === '1'
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState<StakeSuccess | null>(null)
  const positionsQuery = useQuery({
    queryKey: ['staking', 'positions'],
    queryFn: getMyStakingPositions,
  })
  const wallets = useQuery({
    queryKey: ['wallets', user?.uid],
    queryFn: () => fetchUserWallets(user!.uid),
    enabled: Boolean(user?.uid),
  })

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { planId: 'daily_yield', amount: '100' },
  })
  const { errors } = form.formState
  const planId = form.watch('planId')
  const amount = form.watch('amount')
  const amountMinor = previewMinor(amount)
  const selected = PLAN_OPTIONS.find((p) => p.id === planId) ?? PLAN_OPTIONS[0]

  const fundWallet = wallets.data?.find((w) => w.kind === 'fund')
  const fundAvailable = fundWallet?.availableMinor ?? 0
  const belowMin = amountMinor > 0 && amountMinor < MIN_STAKE_USD_CENTS
  const exceedsFund = amountMinor > fundAvailable

  const dailyCredit = amountMinor > 0 ? dailyYieldCents(amountMinor) : 0
  const cap2x = amountMinor > 0 ? payoutCapCents(amountMinor, false) : 0
  const cap3x = amountMinor > 0 ? payoutCapCents(amountMinor, true) : 0
  const lockedPkg = LOCKED_PACKAGES.find((p) => p.id === planId)
  const lockedReturn = lockedPkg && amountMinor > 0 ? amountMinor * lockedPkg.multiplier : 0
  const lockedBonusVfxt =
    lockedPkg && amountMinor > 0
      ? Math.floor((usdCentsToVfxtTokens(amountMinor) * lockedPkg.bonusTokenPct) / 100)
      : 0

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const minor = Number(parseToMinor(values.amount, 2))
      if (minor < MIN_STAKE_USD_CENTS) {
        throw new Error(`Minimum stake is $${(MIN_STAKE_USD_CENTS / 100).toFixed(0)}`)
      }
      if (minor > fundAvailable) {
        throw new Error('Not enough Fund Wallet balance. Deposit first, then stake.')
      }
      return createStakingPosition({
        planId: values.planId as StakingPlanId,
        amountMinor: minor,
        idempotencyKey: crypto.randomUUID(),
      }).then((res) => ({
        ...res,
        planId: values.planId as StakingPlanId,
        amountMinor: minor,
      }))
    },
    onSuccess: async (res) => {
      setSuccess({
        positionId: res.positionId,
        planId: res.planId,
        amountMinor: res.amountMinor,
      })
      form.reset({ planId: form.getValues('planId'), amount: '100' })
      await queryClient.invalidateQueries({ queryKey: ['staking'] })
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const usdMoney = (minor: number) => formatMinor(minor, { scale: 2, currency: 'USD' })

  if (success || previewSuccess) {
    const shown = success ?? {
      positionId: 'preview',
      planId: 'daily_yield' as StakingPlanId,
      amountMinor: 10_000,
    }
    const planLabel = PLAN_LABELS[shown.planId] ?? shown.planId
    const isDaily = shown.planId === 'daily_yield'
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <SuccessReceipt
          title="Stake successful"
          amount={usdMoney(shown.amountMinor)}
          subtitle={
            isDaily
              ? 'Your daily income plan is live. The first ROI credits 24 hours from your stake time.'
              : 'Your lock plan is active. You will receive the maturity payout when the term ends.'
          }
          details={[
            { label: 'Plan', value: planLabel },
            { label: 'Status', value: 'Earning' },
          ]}
          primaryAction={{
            label: 'View my stakes',
            onClick: () => {
              setSuccess(null)
              if (previewSuccess) window.history.replaceState({}, '', '/app/staking')
            },
          }}
          secondaryAction={{
            label: 'Stake again',
            onClick: () => {
              setSuccess(null)
              if (previewSuccess) window.history.replaceState({}, '', '/app/staking')
            },
          }}
        />
        <p className="text-center text-sm text-ink-muted">
          Need more balance?{' '}
          <Link to="/app/deposits" className="font-medium text-accent underline-offset-2 hover:underline">
            Deposit USDT
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Stake & earn"
        description="Put Fund Wallet money into a plan. Daily income pays you regularly. Lock plans pay a larger return when the term ends."
      />

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Choose your plan</CardTitle>
              <CardDescription>Tap one option. You can change it before you stake.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {PLAN_OPTIONS.map((plan) => {
                const active = planId === plan.id
                return (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => form.setValue('planId', plan.id, { shouldValidate: true })}
                    className={cn(
                      'rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow]',
                      active
                        ? 'border-accent bg-accent-soft/40 shadow-sm ring-1 ring-accent/30'
                        : 'border-line bg-panel hover:border-line-strong',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{plan.title}</p>
                        <p className="mt-0.5 text-sm text-ink-muted">{plan.headline}</p>
                      </div>
                      {active ? (
                        <CheckCircle2 className="size-5 shrink-0 text-accent" />
                      ) : (
                        <Badge variant="secondary">{plan.badge}</Badge>
                      )}
                    </div>
                    <ul className="mt-3 space-y-1.5">
                      {plan.points.slice(0, 2).map((point) => (
                        <li key={point} className="flex gap-2 text-xs text-ink-muted">
                          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" />
                          <span>{point}</span>
                        </li>
                      ))}
                    </ul>
                  </button>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
              <div>
                <CardTitle>2. Enter amount & stake</CardTitle>
                <CardDescription>
                  Selected: <span className="font-medium text-ink">{selected.title}</span>
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2">
                <Wallet className="size-4 text-accent" />
                <div>
                  <p className="text-[11px] font-medium text-ink-subtle">Fund Wallet</p>
                  <p className="tabular text-sm font-bold">
                    {wallets.isLoading ? '…' : usdMoney(fundAvailable)}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-5"
                onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
              >
                <input type="hidden" {...form.register('planId')} />

                <div className="space-y-2">
                  <Label htmlFor="amount">Stake amount (USD)</Label>
                  <div className="relative">
                    <AmountInputPrefix />
                    <Input
                      id="amount"
                      inputMode="decimal"
                      placeholder="100.00"
                      autoComplete="off"
                      className="tabular h-14 pl-11 pr-24 font-display text-2xl font-bold"
                      aria-invalid={Boolean(errors.amount) || belowMin || exceedsFund}
                      {...form.register('amount')}
                    />
                    <button
                      type="button"
                      disabled={!fundWallet || fundAvailable <= 0}
                      onClick={() =>
                        form.setValue('amount', (fundAvailable / 100).toFixed(2), {
                          shouldValidate: true,
                        })
                      }
                      className="absolute inset-y-2.5 right-2.5 rounded-lg bg-accent-soft px-3 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                    >
                      Max
                    </button>
                  </div>
                  <FieldError message={errors.amount?.message} />
                  <p className="text-xs text-ink-muted">
                    Minimum ${(MIN_STAKE_USD_CENTS / 100).toFixed(0)}. Uses Fund Wallet only.
                  </p>
                  {belowMin ? (
                    <p className="text-xs font-medium text-warning">
                      Amount is below the ${MIN_STAKE_USD_CENTS / 100} minimum.
                    </p>
                  ) : null}
                  {exceedsFund ? (
                    <p className="text-xs font-medium text-warning">
                      Not enough Fund Wallet balance. Deposit more, then come back.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {['100', '250', '500', '1000'].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => form.setValue('amount', quick, { shouldValidate: true })}
                        className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-ink-muted transition-colors hover:border-accent hover:text-accent"
                      >
                        ${quick}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-line bg-canvas px-4 py-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    What you can expect
                  </p>
                  {selected.kind === 'daily' ? (
                    <>
                      <SummaryRow label="Estimated daily credit" value={usdMoney(dailyCredit)} strong />
                      <SummaryRow label="Max total (no referral)" value={usdMoney(cap2x)} />
                      <SummaryRow label="Max total (with 1+ referral)" value={usdMoney(cap3x)} />
                    </>
                  ) : (
                    <>
                      <SummaryRow label="Lock period" value={`${selected.days} days`} />
                      <SummaryRow label="Approx. maturity payout" value={usdMoney(lockedReturn)} strong />
                      <SummaryRow
                        label="Bonus VFXT at maturity"
                        value={lockedBonusVfxt.toLocaleString()}
                      />
                    </>
                  )}
                </div>

                <div className="rounded-xl border border-line bg-panel-elevated/60 px-4 py-3">
                  <p className="text-sm font-medium">{selected.headline}</p>
                  <ul className="mt-2 space-y-1.5">
                    {selected.points.map((point) => (
                      <li key={point} className="flex gap-2 text-sm text-ink-muted">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  disabled={mutation.isPending || belowMin || exceedsFund || amountMinor <= 0}
                  className="w-full"
                >
                  {mutation.isPending ? 'Starting stake…' : `Stake ${amountMinor > 0 ? usdMoney(amountMinor) : 'now'}`}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <ProcessSteps title="How staking works" steps={HOW_TO_STAKE} image={images.coins} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-ink-muted">
              <div className="flex gap-3">
                <Percent className="mt-0.5 size-4 shrink-0 text-accent" />
                <p>
                  <span className="font-medium text-ink">Daily income</span> is for people who want
                  regular credits. It does not lock your whole return until the end.
                </p>
              </div>
              <div className="flex gap-3">
                <CalendarDays className="mt-0.5 size-4 shrink-0 text-accent" />
                <p>
                  <span className="font-medium text-ink">Lock plans</span> wait until the term ends,
                  then pay a larger return plus bonus VFXT.
                </p>
              </div>
              <div className="flex gap-3">
                <Coins className="mt-0.5 size-4 shrink-0 text-accent" />
                <p>
                  Need balance? Open <span className="font-medium text-ink">Deposit</span>, add USDT,
                  then return here to stake.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your stakes</CardTitle>
          <CardDescription>Every active and finished position from this account.</CardDescription>
        </CardHeader>
        <CardContent>
          {positionsQuery.isLoading ? <LoadingState /> : null}
          {positionsQuery.isError ? (
            <ErrorState
              message={positionsQuery.error.message}
              onRetry={() => positionsQuery.refetch()}
            />
          ) : null}
          {!positionsQuery.isLoading && !positionsQuery.isError ? (
            (positionsQuery.data?.positions ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
                <p className="font-medium">No stakes yet</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Choose a plan above, enter an amount, and tap Stake to start.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {positionsQuery.data!.positions.map((p) => {
                  const label = PLAN_LABELS[p.planId as StakingPlanId] ?? p.planId.replaceAll('_', ' ')
                  return (
                    <div
                      key={p.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-canvas/60 px-4 py-3.5"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold capitalize">{label}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          Started {formatStakingDate(p.createdAt)}
                          {p.planId === 'daily_yield'
                            ? ` · ${p.daysPaid} day${p.daysPaid === 1 ? '' : 's'} paid`
                            : null}
                          {p.planId === 'daily_yield' && p.status === 'active' && p.nextYieldAt
                            ? ` · next ROI ${formatStakingDate(p.nextYieldAt)}`
                            : null}
                          {p.planId === 'daily_yield'
                            ? p.workingAccount
                              ? ' · 3× cap unlocked'
                              : ' · 2× cap'
                            : null}
                        </p>
                      </div>
                      <div className="text-right">
                        <Badge variant={p.status === 'active' ? 'success' : 'secondary'}>
                          {statusLabel(p.status)}
                        </Badge>
                        <p className="mt-1 font-semibold">{usdMoney(p.principalMinor)}</p>
                        <p className="text-xs text-ink-muted">
                          Received {usdMoney(p.totalPaidMinor)}
                          {p.capMinor > 0 ? ` · cap ${usdMoney(p.capMinor)}` : null}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
