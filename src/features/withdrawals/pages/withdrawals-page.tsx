import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { useSearchParams } from 'react-router-dom'
import { AlertTriangle, Loader2, Lock, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { ProcessSteps, SummaryRow } from '@/components/shared/process-steps'
import { RequestHistory } from '@/components/shared/request-history'
import { BscTxLink, bscScanTxUrl } from '@/components/shared/bsc-tx-link'
import { SuccessReceipt } from '@/components/shared/success-receipt'
import { useAuth } from '@/features/auth/auth-context'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import { images } from '@/lib/media'
import { fetchUserWallets, requestWithdrawal } from '@/services/wallet-service'
import { fetchMyWithdrawals } from '@/services/records-service'
import { getPublicPlatformSettings } from '@/services/platform-service'
import {
  splitWithdrawalCommission,
  usdCentsToVfxtTokens,
  vfxtTokensToUsdCents,
} from '@/lib/plan'

const schema = z.object({
  amount: z.string().min(1, 'Amount required'),
  destination: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid BEP-20 address (0x…)'),
  note: z.string().max(200).optional(),
})

type Values = z.infer<typeof schema>

function previewTokens(input: string) {
  const n = Math.floor(Number(String(input).replace(/,/g, '')))
  return Number.isFinite(n) && n > 0 ? n : 0
}

async function fetchLockedWithdrawalAddress(uid: string): Promise<string | null> {
  if (!isFirebaseReady()) return null
  const snap = await getDoc(doc(getDb(), 'users', uid))
  const data = snap.data()
  const raw =
    (typeof data?.withdrawalAddress === 'string' && data.withdrawalAddress) ||
    (typeof data?.walletAddress === 'string' && data.walletAddress) ||
    null
  return raw ? raw.toLowerCase() : null
}

type WithdrawSuccess = {
  amountMinor: number
  usdtCents: number
  destination: string
  status: string
  txHash: string | null
}

export function WithdrawalsPage() {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const previewSuccess = import.meta.env.DEV && searchParams.get('previewSuccess') === '1'
  const queryClient = useQueryClient()
  const [success, setSuccess] = useState<WithdrawSuccess | null>(null)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', destination: '', note: '' },
  })
  const { errors } = form.formState
  const amountTokens = previewTokens(form.watch('amount'))

  const wallets = useQuery({
    queryKey: ['wallets', user?.uid],
    queryFn: () => fetchUserWallets(user!.uid),
    enabled: Boolean(user?.uid),
  })
  const lockedAddress = useQuery({
    queryKey: ['my-withdrawal-address', user?.uid],
    queryFn: () => fetchLockedWithdrawalAddress(user!.uid),
    enabled: Boolean(user?.uid),
  })
  const platform = useQuery({
    queryKey: ['platform', 'public'],
    queryFn: getPublicPlatformSettings,
  })
  const minWithdrawCents = platform.data?.withdraw?.minWithdrawUsdCents ?? 1000
  const tokensPerUsd = platform.data?.token?.tokensPerUsd ?? 10_000
  const minWithdrawTokens = usdCentsToVfxtTokens(minWithdrawCents, tokensPerUsd)
  const commissionBps = platform.data?.withdraw?.commissionBps ?? 0
  const estimatedUsdtCents = vfxtTokensToUsdCents(amountTokens, tokensPerUsd)
  const { commissionMinor, netMinor } = splitWithdrawalCommission(
    estimatedUsdtCents,
    commissionBps,
  )

  const addressLocked = Boolean(lockedAddress.data)
  const destinationValue = form.watch('destination')

  useEffect(() => {
    if (lockedAddress.data) {
      form.setValue('destination', lockedAddress.data, { shouldValidate: true })
    }
  }, [lockedAddress.data, form])

  const withdrawalWallet =
    wallets.data?.find((w) => w.id.endsWith('_withdrawal') || w.kind === 'withdrawal') ??
    wallets.data?.find((w) => w.currency === 'VFXT' && w.kind === 'withdrawal')
  const available = withdrawalWallet?.availableMinor ?? 0
  const exceeds = withdrawalWallet ? amountTokens > available : false
  const belowMin = amountTokens > 0 && amountTokens < minWithdrawTokens

  const history = useQuery({
    queryKey: ['my-withdrawals', user?.uid],
    queryFn: () => fetchMyWithdrawals(user!.uid, 10),
    enabled: Boolean(user?.uid),
  })

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const tokens = previewTokens(values.amount)
      if (tokens <= 0) throw new Error('Amount must be positive')
      if (tokens < minWithdrawTokens) {
        throw new Error(`Minimum withdrawal is ${minWithdrawTokens.toLocaleString()} VFXT`)
      }
      const destination = (lockedAddress.data || values.destination).trim()
      return requestWithdrawal({
        amountMinor: tokens,
        currency: 'VFXT',
        destination,
        idempotencyKey: crypto.randomUUID(),
        note: values.note,
      }).then((res) => ({
        ...(res as { status?: string; txHash?: string | null; netAmountMinor?: number }),
        amountMinor: tokens,
        usdtCents: vfxtTokensToUsdCents(tokens, tokensPerUsd),
        destination,
      }))
    },
    onSuccess: async (res) => {
      const status = res.status ?? 'processing'
      const txHash = res.txHash ?? null
      setSuccess({
        amountMinor: res.amountMinor,
        usdtCents: res.usdtCents,
        destination: res.destination,
        status,
        txHash,
      })
      form.reset({
        amount: '',
        destination: lockedAddress.data || destinationValue || res.destination || '',
        note: '',
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wallets'] }),
        queryClient.invalidateQueries({ queryKey: ['my-withdrawals'] }),
        queryClient.invalidateQueries({ queryKey: ['my-withdrawal-address'] }),
        queryClient.invalidateQueries({ queryKey: ['ledger'] }),
        queryClient.invalidateQueries({ queryKey: ['my-profile'] }),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })

  if (success || previewSuccess) {
    const shown =
      success ??
      ({
        amountMinor: 100_000,
        usdtCents: 1_000,
        destination: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
        status: 'completed',
        txHash: '0xabc123def4567890abc123def4567890abc123def4567890abc123def4567890',
      } satisfies WithdrawSuccess)
    const sent = shown.status === 'completed' && Boolean(shown.txHash)
    const shortAddr = `${shown.destination.slice(0, 8)}…${shown.destination.slice(-6)}`
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <SuccessReceipt
          title={sent ? 'Withdrawal successful' : 'Withdrawal submitted'}
          amount={`${shown.amountMinor.toLocaleString()} VFXT`}
          subtitle={
            sent
              ? `≈ $${(shown.usdtCents / 100).toFixed(2)} USDT sent to your wallet on BNB Smart Chain.`
              : 'Your payout is being processed. You can track it in history below.'
          }
          details={[
            { label: 'Est. USDT', value: `$${(shown.usdtCents / 100).toFixed(2)}` },
            { label: 'To', value: shortAddr },
            { label: 'Status', value: sent ? 'Sent' : 'Processing' },
            ...(shown.txHash
              ? [
                  {
                    label: 'Transaction',
                    value: <BscTxLink txHash={shown.txHash} compact />,
                  },
                ]
              : []),
          ]}
          primaryAction={{
            label: 'Done',
            onClick: () => {
              setSuccess(null)
              if (previewSuccess) window.history.replaceState({}, '', '/app/withdrawals')
            },
          }}
          secondaryAction={
            shown.txHash
              ? {
                  label: 'View on BscScan',
                  onClick: () =>
                    window.open(bscScanTxUrl(shown.txHash!), '_blank', 'noopener,noreferrer'),
                }
              : {
                  label: 'Withdraw again',
                  onClick: () => {
                    setSuccess(null)
                    if (previewSuccess) window.history.replaceState({}, '', '/app/withdrawals')
                  },
                }
          }
        />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Withdraw"
        description="Cash out VFXT from your Withdrawal Wallet as USDT on BNB Smart Chain. The server converts at the admin token price."
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Send as USDT</CardTitle>
              <CardDescription>
                Enter VFXT tokens. Estimated USDT uses {tokensPerUsd.toLocaleString()} VFXT / $1.
              </CardDescription>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2">
              <Wallet className="size-4 text-accent" />
              <div>
                <p className="text-[11px] font-medium text-ink-subtle">Available</p>
                <p className="tabular text-sm font-bold">
                  {wallets.isLoading ? '…' : `${available.toLocaleString()} VFXT`}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (VFXT)</Label>
                <div className="relative">
                  <Input
                    id="amount"
                    inputMode="numeric"
                    placeholder={String(minWithdrawTokens)}
                    autoComplete="off"
                    className="tabular h-16 pr-24 font-display text-2xl font-bold"
                    aria-invalid={Boolean(errors.amount) || exceeds}
                    {...form.register('amount')}
                  />
                  <button
                    type="button"
                    disabled={!withdrawalWallet}
                    onClick={() =>
                      form.setValue('amount', String(available), {
                        shouldValidate: true,
                      })
                    }
                    className="absolute inset-y-3 right-3 rounded-lg bg-accent-soft px-3 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
                <FieldError message={errors.amount?.message} />
                <p className="text-xs text-ink-muted">
                  Min withdraw {minWithdrawTokens.toLocaleString()} VFXT (≈ $
                  {(minWithdrawCents / 100).toFixed(2)})
                  {commissionBps > 0 ? `, fee ${(commissionBps / 100).toFixed(2)}%` : ''}
                </p>
                {amountTokens > 0 ? (
                  <div className="rounded-xl border border-line bg-canvas px-3 py-2 text-sm">
                    <SummaryRow
                      label="Est. USDT before fee"
                      value={`$${(estimatedUsdtCents / 100).toFixed(2)}`}
                    />
                    {commissionBps > 0 ? (
                      <SummaryRow
                        label="Fee"
                        value={`$${(commissionMinor / 100).toFixed(2)}`}
                      />
                    ) : null}
                    <SummaryRow
                      label="Est. USDT sent"
                      value={`$${(netMinor / 100).toFixed(2)}`}
                      strong
                    />
                  </div>
                ) : null}
                {exceeds ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3.5" />
                    Amount exceeds your Withdrawal Wallet balance. Transfer earnings there first.
                  </p>
                ) : null}
                {belowMin ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3.5" />
                    Below minimum withdrawal of {minWithdrawTokens.toLocaleString()} VFXT.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">BEP-20 wallet address</Label>
                {addressLocked ? (
                  <Alert>
                    <Lock className="size-4" />
                    <AlertTitle>Address locked</AlertTitle>
                    <AlertDescription>
                      Withdrawals go only to your linked wallet. Contact support to change it.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Input
                  id="destination"
                  placeholder="0x…"
                  autoComplete="off"
                  disabled={addressLocked}
                  className="font-mono text-sm"
                  aria-invalid={Boolean(errors.destination)}
                  {...form.register('destination')}
                />
                <FieldError message={errors.destination?.message} />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={mutation.isPending || exceeds || belowMin || amountTokens <= 0}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  'Withdraw'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <ProcessSteps
          title="How withdrawals work"
          image={images.tradingDesk}
          steps={[
            {
              title: 'Move VFXT to Withdrawal Wallet',
              body: 'Transfer Daily ROI / Level Income into Withdrawal Wallet first.',
            },
            {
              title: 'Enter VFXT amount',
              body: 'Server converts tokens → USDT at the admin price and applies any fee.',
            },
            {
              title: 'USDT sent on BSC',
              body: 'Manual review or auto-withdraw broadcasts USDT BEP-20 to your address.',
            },
          ]}
        />
      </div>

      <RequestHistory
        kind="withdrawal"
        title="Your withdrawal requests"
        description="Recent cash-outs. Amounts are VFXT reserved; payouts settle in USDT."
        rows={history.data ?? []}
        loading={history.isLoading}
        error={history.isError ? history.error.message : undefined}
      />
    </div>
  )
}
