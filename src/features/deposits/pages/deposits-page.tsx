import { useCallback, useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, Loader2, ShieldCheck, Wallet } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { AmountInputPrefix, ProcessSteps, SummaryRow } from '@/components/shared/process-steps'
import { RequestHistory } from '@/components/shared/request-history'
import { SuccessReceipt } from '@/components/shared/success-receipt'
import { useAuth } from '@/features/auth/auth-context'
import { parseToMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { images } from '@/lib/media'
import {
  getDetectedPayWallets,
  isLikelyMobile,
  openPayWallet,
  type CryptoPayParams,
} from '@/lib/crypto-pay-wallets'
import { sendDepositToken } from '@/lib/deposit-send'
import { VFXT_TOKEN } from '@/lib/vfxt-token'
import { requestDeposit, type CreateDepositResult } from '@/services/wallet-service'
import { checkDepositPayment } from '@/services/crypto-service'
import { fetchMyDeposits } from '@/services/records-service'
import { getPublicPlatformSettings } from '@/services/platform-service'
import { usdCentsToVfxtTokens, vfxtTokensToUsdCents } from '@/lib/plan'

const schema = z.object({
  amount: z.string().min(1, 'Amount required'),
  note: z.string().max(200).optional(),
})

type Values = z.infer<typeof schema>
type DepositAsset = 'USDT' | 'VFXT'

const quickAmountsUsdt = ['100', '500', '1000', '5000']
const quickAmountsVfxt = ['100', '500', '1000', '5000', '10000']
const DEFAULT_USDT = '0x55d398326f99059fF775485246999027B3197955'
const DEFAULT_CHAIN = 56

function assetFromResult(active: CreateDepositResult): DepositAsset {
  if (active.method === 'vfxt_bep20' || active.token === 'VFXT') return 'VFXT'
  return 'USDT'
}

function amountToWei(amount: string): string {
  const [wholeRaw, fracRaw = ''] = amount.trim().split('.')
  const whole = wholeRaw.replace(/\D/g, '') || '0'
  const frac = `${fracRaw.replace(/\D/g, '')}000000000000000000`.slice(0, 18)
  return BigInt(`${whole}${frac}`).toString()
}

function toPayParams(active: CreateDepositResult): CryptoPayParams | null {
  if (!active.depositAddress) return null
  const symbol = assetFromResult(active)
  return {
    depositAddress: active.depositAddress,
    tokenAddress:
      active.tokenAddress ?? (symbol === 'VFXT' ? VFXT_TOKEN.address : DEFAULT_USDT),
    chainId: active.chainId ?? DEFAULT_CHAIN,
    amountWei: active.expectedWei ?? amountToWei(active.amountUsdt),
    amountUsdt: active.amountUsdt,
    symbol,
    eip681: active.qrPayload,
  }
}

export function DepositsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const previewSuccess = import.meta.env.DEV && searchParams.get('previewSuccess') === '1'
  const queryClient = useQueryClient()
  const [asset, setAsset] = useState<DepositAsset>('USDT')
  const [active, setActive] = useState<CreateDepositResult | null>(null)
  const [payStatus, setPayStatus] = useState<string>('awaiting_payment')
  const [txHashInput, setTxHashInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [openedWallet, setOpenedWallet] = useState<string | null>(null)
  const mobile = useMemo(() => isLikelyMobile(), [])
  const payWallets = useMemo(() => getDetectedPayWallets(), [])
  const detectedNames = useMemo(
    () => payWallets.filter((w) => w.detected).map((w) => w.name),
    [payWallets],
  )

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', note: '' },
  })
  const amount = form.watch('amount')

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
  const minVfxtTokens = Math.max(1, usdCentsToVfxtTokens(minDepositCents, tokensPerUsd))
  const quickAmounts = asset === 'VFXT' ? quickAmountsVfxt : quickAmountsUsdt

  const previewUsdtCents = (() => {
    if (asset !== 'USDT' || !amount) return 0
    try {
      return Number(parseToMinor(amount, 2))
    } catch {
      return 0
    }
  })()
  const previewVfxtTokens = (() => {
    if (asset === 'VFXT') {
      const n = Math.floor(Number(amount))
      return Number.isFinite(n) && n > 0 ? n : 0
    }
    return previewUsdtCents > 0 ? usdCentsToVfxtTokens(previewUsdtCents, tokensPerUsd) : 0
  })()
  const previewFundUsd =
    asset === 'VFXT'
      ? vfxtTokensToUsdCents(previewVfxtTokens, tokensPerUsd) / 100
      : previewUsdtCents / 100

  const payParams = active ? toPayParams(active) : null
  const activeAsset = active ? assetFromResult(active) : asset
  const paySymbol = activeAsset

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (asset === 'VFXT') {
        const tokens = Math.floor(Number(values.amount))
        if (!Number.isFinite(tokens) || tokens <= 0) {
          throw new Error('Enter a whole number of VFXT tokens')
        }
        if (tokens < minVfxtTokens) {
          throw new Error(`Minimum VFXT deposit is ${minVfxtTokens.toLocaleString()} tokens`)
        }
        return requestDeposit({
          amountMinor: tokens,
          currency: 'VFXT',
          idempotencyKey: crypto.randomUUID(),
          note: values.note,
          method: 'vfxt_bep20',
        })
      }

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
        const symbol = assetFromResult(result)
        toast.success(
          isLikelyMobile()
            ? `Choose your wallet to pay ${symbol} (BEP-20)`
            : `Scan the QR or connect a wallet to send ${symbol} (BEP-20)`,
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
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['wallets'] }),
            queryClient.invalidateQueries({ queryKey: ['ledger'] }),
            queryClient.invalidateQueries({ queryKey: ['my-deposits'] }),
          ])
        } else if (!opts?.silent) {
          toast.message(`Still waiting for the matching ${paySymbol} transfer on BSC`)
        }
      } catch (e) {
        if (!opts?.silent) {
          toast.error(e instanceof Error ? e.message : 'Check failed')
        }
      } finally {
        setChecking(false)
      }
    },
    [active?.depositId, paySymbol, queryClient],
  )

  useEffect(() => {
    if (!active?.depositId || payStatus === 'completed') return
    const id = window.setInterval(() => {
      void runPaymentCheck(undefined, { silent: true })
    }, 12_000)
    return () => window.clearInterval(id)
  }, [active?.depositId, payStatus, runPaymentCheck])

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
    const wallet = payWallets.find((w) => w.id === walletId)
    if (!wallet) return
    setOpenedWallet(wallet.name)
    toast.message(`Opening ${wallet.name}…`, {
      description: `Send exactly ${payParams.amountUsdt} ${paySymbol} on BSC`,
    })
    openPayWallet(wallet, payParams)
    window.setTimeout(() => void runPaymentCheck(undefined, { silent: true }), 4000)
    window.setTimeout(() => void runPaymentCheck(undefined, { silent: true }), 10000)
  }

  async function handleSendFromWallet() {
    if (!payParams) return
    setSending(true)
    try {
      const result = await sendDepositToken({
        tokenAddress: payParams.tokenAddress,
        depositAddress: payParams.depositAddress,
        amountWei: payParams.amountWei,
        symbol: paySymbol,
      })
      setTxHashInput(result.txHash)
      setOpenedWallet('Connected wallet')
      toast.success(`${paySymbol} sent`, {
        description: 'Waiting for BSC confirmations…',
        action: {
          label: 'BscScan',
          onClick: () => window.open(result.explorerUrl, '_blank', 'noopener,noreferrer'),
        },
      })
      window.setTimeout(() => void runPaymentCheck(result.txHash, { silent: true }), 3000)
      window.setTimeout(() => void runPaymentCheck(result.txHash, { silent: true }), 12000)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to send ${paySymbol}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-w-0 space-y-8 overflow-x-hidden">
      <PageHeader
        title="Deposit"
        description="USDT: enter USD and send USDT. VFXT: enter token count (e.g. 100) and send exactly that many VFXT. We verify on BNB Smart Chain (BEP-20) and credit your wallet."
      />

      {(previewSuccess || (active?.depositAddress && payStatus === 'completed')) ? (
        <div className="mx-auto max-w-xl space-y-4">
          <SuccessReceipt
            title="Payment successful"
            amount={
              previewSuccess
                ? '100.00 USDT'
                : `${active!.amountUsdt} ${assetFromResult(active!)}`
            }
            subtitle={
              previewSuccess
                ? 'Wallet credited — you can stake now.'
                : openedWallet
                  ? `Paid via ${openedWallet}. Wallet credited — you can stake now.`
                  : assetFromResult(active!) === 'VFXT'
                    ? `${Number(active!.amountMinor).toLocaleString()} VFXT recovered to your token wallet.`
                    : 'Fund Wallet credited — you can stake now.'
            }
            details={[
              {
                label: assetFromResult(active!) === 'VFXT' || previewSuccess ? 'VFXT recovered' : 'VFXT credited',
                value: `${(
                  previewSuccess
                    ? usdCentsToVfxtTokens(10_000, tokensPerUsd)
                    : assetFromResult(active!) === 'VFXT'
                      ? active!.amountMinor
                      : usdCentsToVfxtTokens(active!.amountMinor, tokensPerUsd)
                ).toLocaleString()} VFXT`,
              },
              {
                label: 'Network',
                value: previewSuccess ? 'BNB Smart Chain' : active!.network || 'BNB Smart Chain',
              },
              {
                label: 'Paid with',
                value: previewSuccess ? 'USDT' : assetFromResult(active!),
              },
            ]}
            primaryAction={{
              label: 'Stake now',
              onClick: () => {
                setActive(null)
                navigate(previewSuccess ? '/app/staking?previewSuccess=1' : '/app/staking')
              },
            }}
            secondaryAction={{
              label: 'Make another deposit',
              onClick: () => {
                if (previewSuccess) navigate('/app/deposits')
                else setActive(null)
              },
            }}
          />
          <p className="text-center text-sm text-ink-muted">
            Or go to{' '}
            <Link to="/app/wallets" className="font-medium text-accent underline-offset-2 hover:underline">
              Wallets
            </Link>{' '}
            to see balances.
          </p>
        </div>
      ) : null}

      {active?.depositAddress && payStatus !== 'completed' ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <CardTitle className="text-base sm:text-lg">Pay with {paySymbol}</CardTitle>
              <Badge variant="warning">Waiting for payment</Badge>
              <Badge variant="secondary">{paySymbol} · BEP-20</Badge>
            </div>
            <CardDescription>
              Network: {active.network}. Send exactly{' '}
              <span className="inline break-all font-mono text-[11px] text-ink sm:text-xs">
                {active.amountUsdt}
              </span>{' '}
              {paySymbol} (unique amount).
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-6 sm:space-y-8">
            <div className="space-y-3">
              <Button
                type="button"
                size="lg"
                className="w-full whitespace-normal text-center leading-snug"
                disabled={sending || checking}
                onClick={() => void handleSendFromWallet()}
              >
                {sending ? <Loader2 className="animate-spin" /> : <Wallet className="size-4 shrink-0" />}
                {sending ? `Sending ${paySymbol}…` : `Connect wallet & send ${paySymbol}`}
              </Button>
              <p className="break-words text-center text-xs text-ink-muted [overflow-wrap:anywhere]">
                {detectedNames.length > 0
                  ? `Detected: ${detectedNames.join(', ')}. Or use Connect for an injected browser wallet.`
                  : `Uses MetaMask / Trust / injected wallet on BSC, or open VFXT Wallet below.`}
              </p>
            </div>

            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Wallet className="size-4 shrink-0 text-accent" />
                {mobile ? 'Choose an installed wallet' : 'Open in a wallet app'}
              </div>
              <p className="break-words text-xs text-ink-muted [overflow-wrap:anywhere]">
                Detected wallets are listed first. Tap VFXT Wallet, MetaMask, or Trust — it opens with
                this deposit address and exact {paySymbol} amount.
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {payWallets.map((wallet) => (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => handleOpenWallet(wallet.id)}
                    className={cn(
                      'relative flex min-w-0 flex-col items-center gap-1.5 overflow-hidden rounded-2xl border border-line bg-panel-elevated p-3 text-center transition-[transform,background-color,border-color,color] sm:gap-2 sm:p-4',
                      'hover:border-accent/50 hover:shadow-sm active:scale-[0.98]',
                      wallet.detected && 'border-accent/40 bg-accent-soft/40',
                      openedWallet === wallet.name && 'border-accent ring-2 ring-accent/20',
                    )}
                  >
                    {wallet.detected ? (
                      <span className="absolute right-1.5 top-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-accent-ink sm:right-2 sm:top-2 sm:text-[9px]">
                        On
                      </span>
                    ) : null}
                    <span
                      className="grid size-10 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm sm:size-12"
                      style={{ backgroundColor: wallet.color }}
                    >
                      {wallet.glyph}
                    </span>
                    <span className="w-full truncate text-xs font-semibold text-ink sm:text-sm">
                      {wallet.name}
                    </span>
                    <span className="w-full truncate text-[10px] text-ink-subtle sm:text-[11px]">
                      {wallet.subtitle}
                    </span>
                  </button>
                ))}
              </div>
              {openedWallet ? (
                <Alert>
                  <Loader2 className="animate-spin" />
                  <AlertTitle>Complete payment in {openedWallet}</AlertTitle>
                  <AlertDescription>
                    After the {paySymbol} transfer confirms on BSC, you&apos;ll see Payment
                    successful here.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>

            <div className="grid min-w-0 gap-6 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
              <div className="mx-auto w-fit max-w-full rounded-2xl border border-line bg-white p-3 sm:p-4">
                <QRCodeSVG value={active.qrPayload ?? active.depositAddress} size={176} level="M" />
                <p className="mt-2 text-center text-[11px] text-ink-subtle">Or scan QR</p>
              </div>
              <div className="min-w-0 space-y-4 text-sm">
                <div className="min-w-0">
                  <p className="text-ink-muted">Deposit address</p>
                  <p className="mt-1 break-all font-mono text-[11px] leading-relaxed sm:text-xs">
                    {active.depositAddress}
                  </p>
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
                <div className="min-w-0">
                  <SummaryRow
                    label="Exact amount to send"
                    value={`${active.amountUsdt} ${paySymbol}`}
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
                    Each deposit gets a unique exact {paySymbol} amount so your payment credits only
                    your account. Send precisely{' '}
                    <span className="break-all font-mono text-[11px] text-ink">
                      {active.amountUsdt}
                    </span>{' '}
                    {paySymbol} on BSC (BEP-20).
                  </AlertDescription>
                </Alert>
                <div className="min-w-0 space-y-3">
                  <p className="flex items-center gap-2 text-ink-muted">
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                    Listening for your transaction…
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="txHash">Transaction hash (optional)</Label>
                    <Input
                      id="txHash"
                      placeholder="0x… paste from wallet / BscScan"
                      className="min-w-0 font-mono text-xs"
                      value={txHashInput}
                      onChange={(e) => setTxHashInput(e.target.value.trim())}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full whitespace-normal sm:w-auto"
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
              <CardDescription>
                USDT uses a USD amount (send USDT 1:1). VFXT uses a token count — enter 100 and you
                send / recover 100 VFXT.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-6"
                onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              >
                <div className="space-y-2">
                  <Label>Pay with</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: 'USDT' as const,
                          title: 'USDT',
                          body: 'Auto-convert to VFXT at price',
                        },
                        {
                          id: 'VFXT' as const,
                          title: 'VFXT token',
                          body: '1:1 tokens into wallet',
                        },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setAsset(option.id)
                          form.setValue('amount', '', { shouldValidate: false })
                        }}
                        className={cn(
                          'rounded-xl border px-4 py-3 text-left transition-[transform,background-color,border-color,color]',
                          asset === option.id
                            ? 'border-accent bg-accent-soft text-ink ring-2 ring-accent/20'
                            : 'border-line-strong text-ink-muted hover:border-accent/50 hover:text-ink',
                        )}
                      >
                        <span className="block text-sm font-semibold">{option.title}</span>
                        <span className="mt-0.5 block text-xs opacity-80">{option.body}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">
                    {asset === 'VFXT' ? 'Amount (VFXT tokens)' : 'Amount (USD value)'}
                  </Label>
                  <div className="relative">
                    {asset === 'USDT' ? <AmountInputPrefix /> : null}
                    <Input
                      id="amount"
                      inputMode={asset === 'VFXT' ? 'numeric' : 'decimal'}
                      placeholder={asset === 'VFXT' ? '100' : '0.00'}
                      className={cn(
                        'tabular h-16 font-display text-2xl font-bold',
                        asset === 'USDT' ? 'pl-11' : 'pl-3.5',
                      )}
                      {...form.register('amount')}
                    />
                    <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-sm font-semibold text-ink-subtle">
                      {asset === 'VFXT' ? 'VFXT' : 'USD'}
                    </span>
                  </div>
                  <FieldError message={form.formState.errors.amount?.message} />
                  <p className="text-xs text-ink-muted">
                    {asset === 'VFXT' ? (
                      <>
                        Min {minVfxtTokens.toLocaleString()} VFXT. Example: send{' '}
                        <span className="font-semibold text-ink">100 VFXT</span> →{' '}
                        <span className="font-semibold text-ink">100 VFXT</span> added to your
                        token wallet (1:1). You will recover{' '}
                        <span className="font-semibold text-ink">
                          {previewVfxtTokens > 0
                            ? `${previewVfxtTokens.toLocaleString()} VFXT`
                            : '—'}
                        </span>
                        {previewFundUsd > 0
                          ? ` (≈ $${previewFundUsd.toFixed(2)} Fund credit at ${tokensPerUsd.toLocaleString()} VFXT / $1)`
                          : ''}
                        .
                      </>
                    ) : (
                      <>
                        Min deposit ${(minDepositCents / 100).toFixed(2)}. USDT is converted at the
                        token price ({tokensPerUsd.toLocaleString()} VFXT / $1). Example:{' '}
                        <span className="font-semibold text-ink">1 USDT</span> →{' '}
                        <span className="font-semibold text-ink">
                          {usdCentsToVfxtTokens(100, tokensPerUsd).toLocaleString()} VFXT
                        </span>{' '}
                        added to your token wallet
                        {previewVfxtTokens > 0 ? (
                          <>
                            . This amount →{' '}
                            <span className="font-semibold text-ink">
                              {previewVfxtTokens.toLocaleString()} VFXT
                            </span>
                          </>
                        ) : null}
                        .
                      </>
                    )}
                  </p>
                  <div
                    className={cn(
                      'grid gap-2 pt-1',
                      asset === 'VFXT' ? 'grid-cols-5' : 'grid-cols-4',
                    )}
                  >
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
                        {asset === 'VFXT'
                          ? Number(value).toLocaleString()
                          : `$${Number(value).toLocaleString()}`}
                      </button>
                    ))}
                  </div>
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending}>
                  {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                  {mutation.isPending
                    ? 'Preparing payment…'
                    : mobile
                      ? `Continue to pay ${asset}`
                      : `Generate ${asset} deposit`}
                </Button>
              </form>
            </CardContent>
          </Card>
          <ProcessSteps
            title="How crypto deposits work"
            image={images.tradingDesk}
            steps={[
              {
                title: 'Choose USDT or VFXT',
                body: 'USDT converts to VFXT at token price. VFXT deposits credit the same token count.',
              },
              {
                title: 'Open wallet & pay',
                body: 'Connect your wallet to send, or pick MetaMask / Trust with amount filled in.',
              },
              {
                title: 'Auto credit',
                body: '1 USDT → VFXT at price. 100 VFXT sent → 100 VFXT in wallet.',
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
