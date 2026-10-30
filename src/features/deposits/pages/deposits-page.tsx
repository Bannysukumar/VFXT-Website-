import { useCallback, useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { AmountInputPrefix, ProcessSteps, SummaryRow } from '@/components/shared/process-steps'
import { RequestHistory } from '@/components/shared/request-history'
import { useAuth } from '@/features/auth/auth-context'
import { parseToMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { images } from '@/lib/media'
import {
  isLikelyMobile,
  openPayWallet,
  PAY_WALLETS,
  type CryptoPayParams,
} from '@/lib/crypto-pay-wallets'
import { requestDeposit, type CreateDepositResult } from '@/services/wallet-service'
import { checkDepositPayment } from '@/services/crypto-service'
import { fetchMyDeposits } from '@/services/records-service'
import { getPublicPlatformSettings } from '@/services/platform-service'
import { usdCentsToVfxtTokens } from '@/lib/plan'

const schema = z.object({
  amount: z.string().min(1, 'Amount required'),
  note: z.string().max(200).optional(),
})

type Values = z.infer<typeof schema>

const quickAmounts = ['100', '500', '1000', '5000']
const DEFAULT_USDT = '0x55d398326f99059fF775485246999027B3197955'
const DEFAULT_CHAIN = 56

function previewMinor(input: string) {
  try {
    return input ? Number(parseToMinor(input, 2)) : 0
  } catch {
    return 0
  }
}

function usdtAmountToWei(amountUsdt: string): string {
  const [wholeRaw, fracRaw = ''] = amountUsdt.trim().split('.')
  const whole = wholeRaw.replace(/\D/g, '') || '0'
  const frac = `${fracRaw.replace(/\D/g, '')}000000000000000000`.slice(0, 18)
  return BigInt(`${whole}${frac}`).toString()
}

function toPayParams(active: CreateDepositResult): CryptoPayParams | null {
  if (!active.depositAddress) return null
  return {
    depositAddress: active.depositAddress,
    tokenAddress: active.tokenAddress ?? DEFAULT_USDT,
    chainId: active.chainId ?? DEFAULT_CHAIN,
    amountWei: active.expectedWei ?? usdtAmountToWei(active.amountUsdt),
    amountUsdt: active.amountUsdt,
    eip681: active.qrPayload,
  }
}

export function DepositsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [active, setActive] = useState<CreateDepositResult | null>(null)
  const [payStatus, setPayStatus] = useState<string>('awaiting_payment')
  const [txHashInput, setTxHashInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [openedWallet, setOpenedWallet] = useState<string | null>(null)
  const mobile = useMemo(() => isLikelyMobile(), [])

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', note: '' },
  })
  const amount = form.watch('amount')
  void previewMinor

  const history = useQuery({
    queryKey: ['my-deposits', user?.uid],
    queryFn: () => fetchMyDeposits(user!.uid, 10),
    enabled: Boolean(user?.uid),
  })

  const platform = useQuery({
    queryKey: ['platform', 'public'],
    queryFn: getPublicPlatformSettings,
  })

  const tokensPerUsd = platform.data?.token?.tokensPerUsd ?? 10_000
  const minDepositCents = platform.data?.deposit?.minDepositUsdCents ?? 1000
  const previewTokens = (() => {
    try {
      const minor = amount ? Number(parseToMinor(amount, 2)) : 0
      return minor > 0 ? usdCentsToVfxtTokens(minor, tokensPerUsd) : 0
    } catch {
      return 0
    }
  })()

  const payParams = active ? toPayParams(active) : null

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const minor = Number(parseToMinor(values.amount, 2))
      if (minor <= 0) throw new Error('Amount must be positive')
      if (minor < minDepositCents) {
        throw new Error(`Minimum deposit is $${(minDepositCents / 100).toFixed(2)}`)
      }
      return requestDeposit({
        amountMinor: minor,
        currency: 'USD',
        idempotencyKey: crypto.randomUUID(),
        note: values.note,
        method: 'usdt_bep20',
      })
    },
    onSuccess: async (result) => {
      if (result.depositAddress && result.qrPayload) {
        setActive(result)
        setPayStatus(result.status)
        setOpenedWallet(null)
        toast.success(
          isLikelyMobile()
            ? 'Choose your wallet to pay USDT (BEP-20)'
            : 'Scan the QR or open a wallet to send USDT (BEP-20)',
        )
      } else {
        toast.success('Deposit submitted for manual review')
      }
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['my-deposits'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const runPaymentCheck = useCallback(
    async (txHash?: string, opts?: { silent?: boolean }) => {
      if (!active?.depositId) return
      setChecking(true)
      try {
        const cleaned = txHash?.trim()
        const res = await checkDepositPayment(
          active.depositId,
          cleaned && /^0x[0-9a-fA-F]{64}$/.test(cleaned) ? cleaned : undefined,
        )
        setPayStatus(res.status)
        if (res.status === 'completed') {
          toast.success('Payment successful — USD + VFXT credited (ready to stake)')
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['wallets'] }),
            queryClient.invalidateQueries({ queryKey: ['ledger'] }),
            queryClient.invalidateQueries({ queryKey: ['my-deposits'] }),
          ])
        } else if (!opts?.silent) {
          toast.message('Still waiting for the matching USDT transfer on BSC')
        }
      } catch (e) {
        if (!opts?.silent) {
          toast.error(e instanceof Error ? e.message : 'Check failed')
        }
      } finally {
        setChecking(false)
      }
    },
    [active?.depositId, queryClient],
  )

  // Poll while waiting
  useEffect(() => {
    if (!active?.depositId || payStatus === 'completed') return
    const id = window.setInterval(() => {
      void runPaymentCheck(undefined, { silent: true })
    }, 12_000)
    return () => window.clearInterval(id)
  }, [active?.depositId, payStatus, runPaymentCheck])

  // When user returns from MetaMask / GPay-style wallet app → recheck immediately
  useEffect(() => {
    if (!active?.depositId || payStatus === 'completed') return

    const onReturn = () => {
      if (document.visibilityState === 'visible') {
        void runPaymentCheck(undefined, { silent: true })
      }
    }

    document.addEventListener('visibilitychange', onReturn)
    window.addEventListener('focus', onReturn)
    window.addEventListener('pageshow', onReturn)
    return () => {
      document.removeEventListener('visibilitychange', onReturn)
      window.removeEventListener('focus', onReturn)
      window.removeEventListener('pageshow', onReturn)
    }
  }, [active?.depositId, payStatus, runPaymentCheck])

  function handleOpenWallet(walletId: string) {
    if (!payParams) return
    const wallet = PAY_WALLETS.find((w) => w.id === walletId)
    if (!wallet) return
    setOpenedWallet(wallet.name)
    toast.message(`Opening ${wallet.name}…`, {
      description: `Send exactly ${payParams.amountUsdt} USDT on BSC`,
    })
    openPayWallet(wallet, payParams)
    // Aggressive short poll right after handoff
    window.setTimeout(() => void runPaymentCheck(undefined, { silent: true }), 4000)
    window.setTimeout(() => void runPaymentCheck(undefined, { silent: true }), 10000)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Deposit USDT"
        description="Enter an amount, open your wallet (or scan the QR), send USDT on BNB Smart Chain (BEP-20). We verify the transfer and credit your Fund Wallet automatically."
      />

      {active?.depositAddress && payStatus === 'completed' ? (
        <Card className="overflow-hidden border-success/30 bg-gradient-to-b from-success/10 to-panel">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="grid size-24 place-items-center rounded-full bg-success/15 text-success">
              <CheckCircle2 className="size-14" />
            </div>
            <div className="space-y-1">
              <h2 className="font-display text-2xl font-bold text-ink">Payment successful</h2>
              <p className="text-ink-muted">
                {active.amountUsdt} USDT credited
                {openedWallet ? ` via ${openedWallet}` : ''}. Fund Wallet updated and{' '}
                {usdCentsToVfxtTokens(active.amountMinor, tokensPerUsd).toLocaleString()} VFXT added.
                You can stake now.
              </p>
            </div>
            <Button size="lg" onClick={() => setActive(null)}>
              Make another deposit
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {active?.depositAddress && payStatus !== 'completed' ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Pay with wallet</CardTitle>
              <Badge variant="warning">Waiting for payment</Badge>
            </div>
            <CardDescription>
              Network: {active.network}, Send exactly {active.amountUsdt} USDT (unique amount)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {/* Wallet chooser — PhonePe / GPay style */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Wallet className="size-4 text-accent" />
                {mobile ? 'Choose an installed wallet' : 'Open in a wallet app'}
              </div>
              <p className="text-xs text-ink-muted">
                Tap your wallet — it opens with this deposit address and exact amount. After you pay,
                return here; we confirm automatically.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PAY_WALLETS.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => handleOpenWallet(wallet.id)}
                    className={cn(
                      'flex flex-col items-center gap-2 rounded-2xl border border-line bg-panel-elevated p-4 text-center transition-[transform,background-color,border-color,color]',
                      'hover:border-accent/50 hover:shadow-sm active:scale-[0.98]',
                      openedWallet === wallet.name && 'border-accent ring-2 ring-accent/20',
                    )}
                  >
                    <span
                      className="grid size-12 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: wallet.color }}
                    >
                      {wallet.glyph}
                    </span>
                    <span className="text-sm font-semibold text-ink">{wallet.name}</span>
                    <span className="text-[11px] text-ink-subtle">{wallet.subtitle}</span>
                  </button>
                ))}
              </div>
              {openedWallet ? (
                <Alert>
                  <Loader2 className="animate-spin" />
                  <AlertTitle>Complete payment in {openedWallet}</AlertTitle>
                  <AlertDescription>
                    After the transfer confirms on BSC, you&apos;ll be shown Payment successful here
                    (same idea as returning from PhonePe / GPay).
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="grid gap-8 md:grid-cols-[220px_1fr]">
              <div className="mx-auto rounded-2xl border border-line bg-white p-4">
                <QRCodeSVG value={active.qrPayload ?? active.depositAddress} size={192} level="M" />
                <p className="mt-2 text-center text-[11px] text-ink-subtle">Or scan QR</p>
              </div>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-ink-muted">Deposit address</p>
                  <p className="mt-1 break-all font-mono text-xs">{active.depositAddress}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      await navigator.clipboard.writeText(active.depositAddress!)
                      toast.success('Address copied')
                    }}
                  >
                    <Copy className="size-4" />
                    Copy address
                  </Button>
                </div>
                <div>
                  <SummaryRow
                    label="Exact amount to send"
                    value={`${active.amountUsdt} USDT`}
                    strong
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={async () => {
                      await navigator.clipboard.writeText(active.amountUsdt)
                      toast.success('Exact amount copied')
                    }}
                  >
                    <Copy className="size-4" />
                    Copy exact amount
                  </Button>
                </div>
                <SummaryRow label="Token contract" value={active.tokenAddress ?? '—'} />
                <Alert>
                  <ShieldCheck />
                  <AlertTitle>Automatic verification</AlertTitle>
                  <AlertDescription>
                    Each deposit gets a unique exact USDT amount so your payment credits only your
                    account. Send precisely {active.amountUsdt} USDT on BSC (BEP-20).
                  </AlertDescription>
                </Alert>
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-ink-muted">
                    <Loader2 className="size-4 animate-spin" />
                    Listening for your transaction…
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="txHash">Transaction hash (optional)</Label>
                    <Input
                      id="txHash"
                      placeholder="0x… paste from your wallet / BscScan"
                      className="font-mono text-xs"
                      value={txHashInput}
                      onChange={(e) => setTxHashInput(e.target.value.trim())}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={checking}
                    onClick={() => void runPaymentCheck(txHashInput)}
                  >
                    {checking ? <Loader2 className="size-4 animate-spin" /> : null}
                    {checking ? 'Checking…' : 'I have paid — check now'}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!active?.depositAddress ? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Deposit amount</CardTitle>
              <CardDescription>1 USD = 1 USDT on BNB Smart Chain (BEP-20).</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              >
                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <div className="relative">
                    <AmountInputPrefix />
                    <Input
                      id="amount"
                      inputMode="decimal"
                      placeholder="0.00"
                      className="tabular h-16 pl-11 font-display text-2xl font-bold"
                      {...form.register('amount')}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-sm font-semibold text-ink-subtle">
                      USD
                    </span>
                  </div>
                  <FieldError message={form.formState.errors.amount?.message} />
                  <p className="text-xs text-ink-muted">
                    Min deposit ${(minDepositCents / 100).toFixed(2)}, you receive ≈{' '}
                    <span className="font-semibold text-ink">
                      {previewTokens.toLocaleString()} VFXT
                    </span>{' '}
                    (at {tokensPerUsd.toLocaleString()} VFXT / $1) plus Fund Wallet credit for
                    staking.
                  </p>
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {quickAmounts.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => form.setValue('amount', value, { shouldValidate: true })}
                        className={cn(
                          'tabular rounded-lg border py-2 text-sm font-semibold transition-[transform,background-color,border-color,color]',
                          amount === value
                            ? 'border-accent bg-accent-soft text-accent'
                            : 'border-line-strong text-ink-muted hover:border-accent/50 hover:text-ink',
                        )}
                      >
                        ${Number(value).toLocaleString()}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                  {mutation.isPending
                    ? 'Preparing payment…'
                    : mobile
                      ? 'Continue to pay'
                      : 'Generate deposit QR'}
                </Button>
              </form>
            </CardContent>
          </Card>
          <ProcessSteps
            title="How crypto deposits work"
            image={images.tradingDesk}
            steps={[
              { title: 'Enter amount', body: 'We create a pending deposit for the exact USDT amount.' },
              {
                title: 'Open wallet & pay',
                body: 'Pick MetaMask, Trust, TokenPocket, etc. — amount and address are filled in.',
              },
              {
                title: 'Auto credit',
                body: 'Return to this page; after on-chain confirmation you see Payment successful.',
              },
            ]}
          />
        </div>
      ) : null}

      <RequestHistory
        kind="deposit"
        title="Your deposit requests"
        description="Recent deposits including crypto payments."
        rows={history.data ?? []}
        loading={history.isLoading}
        error={history.isError ? history.error.message : undefined}
      />
    </div>
  )
}
