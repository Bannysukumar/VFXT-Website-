import { useCallback, useEffect, useMemo, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, Loader2, QrCode, ShieldCheck, Wallet } from 'lucide-react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { AmountInputPrefix, ProcessSteps } from '@/components/shared/process-steps'
import { RequestHistory } from '@/components/shared/request-history'
import { SuccessReceipt } from '@/components/shared/success-receipt'
import { useAuth } from '@/features/auth/auth-context'
import { parseToMinor } from '@/lib/money'
import { cn } from '@/lib/utils'
import { images } from '@/lib/media'
import {
  getInstalledPayWallets,
  getMissingPayWallets,
  hasInjectedEthereum,
  isLikelyMobile,
  openPayWallet,
  type CryptoPayParams,
  type PayWalletOption,
} from '@/lib/crypto-pay-wallets'
import { sendDepositToken } from '@/lib/deposit-send'
import { VFXT_TOKEN } from '@/lib/vfxt-token'
import { requestDeposit, type CreateDepositResult } from '@/services/wallet-service'
import { checkDepositPayment } from '@/services/crypto-service'
import { fetchMyDeposits } from '@/services/records-service'
import { getPublicPlatformSettings } from '@/services/platform-service'
import { minVfxtTokensForOneCent, usdCentsToVfxtTokens } from '@/lib/plan'

const ACTIVE_DEPOSIT_KEY = 'vfxt.activeDeposit.v1'

function saveActiveDeposit(result: CreateDepositResult) {
  try {
    sessionStorage.setItem(ACTIVE_DEPOSIT_KEY, JSON.stringify(result))
  } catch {
    /* ignore quota / private mode */
  }
}

function loadActiveDeposit(): CreateDepositResult | null {
  try {
    const raw = sessionStorage.getItem(ACTIVE_DEPOSIT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CreateDepositResult
  } catch {
    return null
  }
}

function clearActiveDeposit() {
  try {
    sessionStorage.removeItem(ACTIVE_DEPOSIT_KEY)
  } catch {
    /* ignore */
  }
}

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
  const [active, setActive] = useState<CreateDepositResult | null>(() => loadActiveDeposit())
  const [payStatus, setPayStatus] = useState<string>(
    () => loadActiveDeposit()?.status ?? 'awaiting_payment',
  )
  const [txHashInput, setTxHashInput] = useState('')
  const [checking, setChecking] = useState(false)
  const [sending, setSending] = useState(false)
  const [openedWallet, setOpenedWallet] = useState<string | null>(null)
  const checkSeq = useMemo(() => ({ current: 0 }), [])
  const mobile = useMemo(() => isLikelyMobile(), [])
  const [installedWallets, setInstalledWallets] = useState<PayWalletOption[]>(() =>
    getInstalledPayWallets(),
  )
  const [missingWallets, setMissingWallets] = useState<PayWalletOption[]>(() =>
    getMissingPayWallets(),
  )
  const [canConnectInjected, setCanConnectInjected] = useState(() => hasInjectedEthereum())
  const [showInstallList, setShowInstallList] = useState(false)

  useEffect(() => {
    const refresh = () => {
      setInstalledWallets(getInstalledPayWallets())
      setMissingWallets(getMissingPayWallets())
      setCanConnectInjected(hasInjectedEthereum())
    }
    refresh()
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    window.addEventListener('ethereum#initialized', onFocus as EventListener)
    // EIP-6963 / late-injected providers
    const id = window.setInterval(refresh, 2500)
    window.setTimeout(refresh, 400)
    window.setTimeout(refresh, 1200)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('ethereum#initialized', onFocus as EventListener)
      window.clearInterval(id)
    }
  }, [])

  const detectedNames = useMemo(
    () => installedWallets.map((w) => w.name),
    [installedWallets],
  )
  const payWallets = installedWallets

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
  // Admin Min VFXT deposit wins; one-cent floor only when unset.
  const configuredVfxtMin = platform.data?.deposit?.minVfxtDepositTokens
  const minVfxtTokens = Math.max(
    1,
    Number.isFinite(configuredVfxtMin) && (configuredVfxtMin ?? 0) > 0
      ? Math.floor(Number(configuredVfxtMin))
      : Math.max(
          usdCentsToVfxtTokens(minDepositCents, tokensPerUsd),
          minVfxtTokensForOneCent(tokensPerUsd),
        ),
  )
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
  const previewFundTokens =
    asset === 'VFXT'
      ? previewVfxtTokens
      : previewUsdtCents > 0
        ? usdCentsToVfxtTokens(previewUsdtCents, tokensPerUsd)
        : 0

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
        setPayStatus(result.status || 'awaiting_payment')
        setOpenedWallet(null)
        setTxHashInput('')
        saveActiveDeposit(result)
        const symbol = assetFromResult(result)
        toast.success(
          isLikelyMobile()
            ? `Choose your wallet to pay ${symbol} (BEP-20)`
            : `Scan the QR or connect a wallet to send ${symbol} (BEP-20)`,
        )
      } else {
        clearActiveDeposit()
        toast.success('Deposit submitted for manual review')
      }
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['my-deposits'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const dismissActive = useCallback(() => {
    clearActiveDeposit()
    setActive(null)
    setPayStatus('awaiting_payment')
    setOpenedWallet(null)
    setTxHashInput('')
  }, [])

  const runPaymentCheck = useCallback(
    async (txHash?: string, opts?: { silent?: boolean }) => {
      if (!active?.depositId) return
      if (payStatus === 'completed') return
      const seq = ++checkSeq.current
      setChecking(true)
      try {
        const cleaned = txHash?.trim()
        const res = await checkDepositPayment(
          active.depositId,
          cleaned && /^0x[0-9a-fA-F]{64}$/.test(cleaned) ? cleaned : undefined,
        )
        // Ignore stale overlapping polls so "completed" is never overwritten.
        if (seq !== checkSeq.current) return

        if (res.status === 'completed' || res.status === 'approved') {
          setPayStatus('completed')
          saveActiveDeposit({ ...active, status: 'completed' })
          if (!opts?.silent) {
            toast.success('Payment verified — Fund Wallet credited')
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['wallets'] }),
            queryClient.invalidateQueries({ queryKey: ['ledger'] }),
            queryClient.invalidateQueries({ queryKey: ['my-deposits'] }),
          ])
          return
        }

        if (res.status === 'pending' || res.manualReview) {
          setPayStatus('pending')
          saveActiveDeposit({ ...active, status: 'pending' })
          clearActiveDeposit()
          if (!opts?.silent) {
            toast.message('Sent for admin review', {
              description:
                res.observedAmountDisplay
                  ? `Detected ${res.observedAmountDisplay} ${paySymbol}. Admin will credit the correct amount.`
                  : 'We could not auto-match this payment. Admin will review your transaction hash.',
            })
          }
          await queryClient.invalidateQueries({ queryKey: ['my-deposits'] })
          setActive(null)
          return
        }

        if (res.status === 'expired' || res.status === 'cancelled' || res.status === 'rejected') {
          setPayStatus(res.status)
          clearActiveDeposit()
          if (!opts?.silent) toast.error(`Deposit ${res.status}`)
          return
        }

        // Sole remaining depositor for this amount → decimals cleared back to usual.
        if (res.amountUsdt && res.expectedWei && active) {
          const next = {
            ...active,
            amountUsdt: res.amountUsdt,
            expectedWei: res.expectedWei,
            status: res.status || active.status,
            qrPayload:
              active.tokenAddress && res.expectedWei
                ? `ethereum:${active.tokenAddress}@${active.chainId ?? 56}/transfer?address=${active.depositAddress}&uint256=${res.expectedWei}`
                : active.qrPayload,
          }
          if (
            next.amountUsdt !== active.amountUsdt ||
            next.expectedWei !== active.expectedWei
          ) {
            setActive(next)
            saveActiveDeposit(next)
            if (res.amountNormalized) {
              toast.message(`Amount updated to usual ${res.amountUsdt} ${paySymbol}`, {
                description: 'No other member is depositing this amount right now.',
              })
            }
          }
        }

        setPayStatus(res.status || 'awaiting_payment')
        if (!opts?.silent) {
          toast.message(`Still waiting for the matching ${paySymbol} transfer on BSC`)
        }
      } catch (e) {
        if (seq !== checkSeq.current) return
        if (!opts?.silent) {
          toast.error(e instanceof Error ? e.message : 'Check failed')
        }
      } finally {
        if (seq === checkSeq.current) setChecking(false)
      }
    },
    [active, checkSeq, payStatus, paySymbol, queryClient],
  )

  // Restore / sync active deposit from history (completed or still awaiting).
  useEffect(() => {
    if (!history.data?.length) return
    if (payStatus === 'completed') return

    if (active?.depositId) {
      const row = history.data.find((d) => d.id === active.depositId)
      if (!row) return
      const st = String(row.status)
      if (st === 'completed' || st === 'approved') {
        setPayStatus('completed')
        saveActiveDeposit({ ...active, status: 'completed' })
      } else if (st === 'expired' || st === 'cancelled' || st === 'rejected') {
        dismissActive()
      }
      return
    }

    const open = history.data.find((d) => {
      const st = String(d.status)
      return st === 'awaiting_payment' || st === 'pending'
    })
    if (!open?.depositAddress) return
    const saved = loadActiveDeposit()
    if (saved?.depositId === open.id && saved.depositAddress) {
      setActive(saved)
      setPayStatus(saved.status || 'awaiting_payment')
      return
    }
    // Reconstruct pay UI from Firestore history so refresh doesn't lose the payment screen.
    const symbol =
      open.method === 'vfxt_bep20' || open.tokenSymbol === 'VFXT' ? 'VFXT' : 'USDT'
    let amountDisplay =
      symbol === 'VFXT' ? String(open.amountMinor) : (open.amountMinor / 100).toFixed(2)
    if (open.expectedWei) {
      try {
        // Show 6 decimals so wallets / copy field keep the unique payment tag.
        const wei = BigInt(open.expectedWei)
        const whole = wei / 10n ** 18n
        const frac = (wei % 10n ** 18n).toString().padStart(18, '0').slice(0, 6)
        amountDisplay = `${whole.toString()}.${frac}`
      } catch {
        /* keep fallback */
      }
    }
    const reconstructed: CreateDepositResult = {
      depositId: open.id,
      status: String(open.status),
      method: open.method || (symbol === 'VFXT' ? 'vfxt_bep20' : 'usdt_bep20'),
      depositAddress: open.depositAddress,
      amountUsdt: amountDisplay,
      amountMinor: open.amountMinor,
      network: 'BSC (BEP-20)',
      token: symbol,
      tokenAddress: open.tokenAddress ?? null,
      qrPayload:
        open.qrPayload ??
        (open.tokenAddress && open.expectedWei
          ? `ethereum:${open.tokenAddress}@56/transfer?address=${open.depositAddress}&uint256=${open.expectedWei}`
          : null),
      chainId: open.chainId ?? 56,
      expectedWei: open.expectedWei ?? null,
    }
    setActive(reconstructed)
    setPayStatus(String(open.status) || 'awaiting_payment')
    saveActiveDeposit(reconstructed)
  }, [history.data, active, payStatus, dismissActive])

  useEffect(() => {
    if (!active?.depositId || payStatus === 'completed') return
    void runPaymentCheck(undefined, { silent: true })
    const id = window.setInterval(() => {
      void runPaymentCheck(undefined, { silent: true })
    }, 8_000)
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
        description="Pay with USDT or VFXT on BNB Smart Chain (BEP-20). Verified payments credit VFXT tokens to your Fund Wallet for staking."
      />

      {(previewSuccess || (active?.depositAddress && payStatus === 'completed')) ? (
        <div className="mx-auto max-w-xl space-y-4">
          <SuccessReceipt
            title="Payment successful"
            amount={
              previewSuccess
                ? `${(100 * tokensPerUsd).toLocaleString()} VFXT`
                : assetFromResult(active!) === 'VFXT'
                  ? `${active!.amountMinor.toLocaleString()} VFXT`
                  : `${usdCentsToVfxtTokens(active!.amountMinor, tokensPerUsd).toLocaleString()} VFXT`
            }
            subtitle={
              previewSuccess
                ? 'Fund Wallet credited — you can stake now.'
                : openedWallet
                  ? `Paid via ${openedWallet}. Fund Wallet credited — you can stake now.`
                  : 'Fund Wallet credited — you can stake now.'
            }
            details={[
              {
                label: 'Fund Wallet credit',
                value: previewSuccess
                  ? `${(100 * tokensPerUsd).toLocaleString()} VFXT`
                  : assetFromResult(active!) === 'VFXT'
                    ? `${active!.amountMinor.toLocaleString()} VFXT`
                    : `${usdCentsToVfxtTokens(active!.amountMinor, tokensPerUsd).toLocaleString()} VFXT`,
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
                dismissActive()
                navigate(previewSuccess ? '/app/staking?previewSuccess=1' : '/app/staking')
              },
            }}
            secondaryAction={{
              label: 'Make another deposit',
              onClick: () => {
                dismissActive()
                if (previewSuccess) navigate('/app/deposits')
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
        <div className="mx-auto w-full max-w-3xl space-y-4">
          <Card className="overflow-hidden border-line shadow-sm">
            <CardHeader className="space-y-4 border-b border-line bg-panel-elevated/40 pb-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">Waiting for payment</Badge>
                <Badge variant="secondary">BSC · BEP-20</Badge>
                <Badge variant="secondary">{paySymbol}</Badge>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">
                  Send exactly
                </p>
                <p className="mt-1 break-all font-mono text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
                  {active.amountUsdt}{' '}
                  <span className="text-lg font-semibold text-ink-muted sm:text-xl">{paySymbol}</span>
                </p>
                {active.amountUsdt.includes('.') && !/\.0+$/.test(active.amountUsdt) ? (
                  <p className="mt-2 text-xs text-ink-muted">
                    Unique decimals are active because another deposit is using this same amount.
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink-muted">
                    Network: {active.network || 'BNB Smart Chain (BEP-20)'}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(active.amountUsdt)
                    toast.success('Amount copied')
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy amount
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await navigator.clipboard.writeText(active.depositAddress!)
                    toast.success('Address copied')
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy address
                </Button>
              </div>
            </CardHeader>

            <CardContent className="min-w-0 space-y-6 pt-6">
              {canConnectInjected ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    disabled={sending || checking}
                    onClick={() => void handleSendFromWallet()}
                  >
                    {sending ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Wallet className="size-4 shrink-0" />
                    )}
                    {sending ? `Sending ${paySymbol}…` : `Connect wallet & send ${paySymbol}`}
                  </Button>
                  <p className="text-center text-xs text-ink-muted">
                    {detectedNames.length > 0
                      ? `Ready: ${detectedNames.join(', ')}`
                      : 'Uses your browser wallet on BSC'}
                  </p>
                </div>
              ) : null}

              <div className="min-w-0 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Installed wallets</p>
                    <p className="text-xs text-ink-muted">
                      Only wallets detected on this device are shown.
                    </p>
                  </div>
                  {installedWallets.length > 0 ? (
                    <Badge variant="secondary" className="shrink-0">
                      {installedWallets.length} found
                    </Badge>
                  ) : null}
                </div>

                {installedWallets.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {installedWallets.map((wallet) => (
                      <button
                        key={wallet.id}
                        type="button"
                        onClick={() => handleOpenWallet(wallet.id)}
                        className={cn(
                          'relative flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-panel px-3 py-3 text-left transition-[transform,border-color,background-color] hover:border-accent/50 active:scale-[0.99]',
                          openedWallet === wallet.name && 'border-accent bg-accent-soft/50 ring-2 ring-accent/15',
                        )}
                      >
                        <span
                          className="grid size-10 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-white"
                          style={{ backgroundColor: wallet.color }}
                        >
                          {wallet.glyph}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">
                            {wallet.name}
                          </span>
                          <span className="block truncate text-[11px] text-success">Installed</span>
                        </span>
                        <CheckCircle2 className="ml-auto size-4 shrink-0 text-success" />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-line bg-panel-elevated/50 px-4 py-5 text-center">
                    <Wallet className="mx-auto size-8 text-ink-subtle" />
                    <p className="mt-2 text-sm font-medium text-ink">No wallet app detected here</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Use the QR code or copy details below, or open this page inside your wallet
                      browser.
                    </p>
                  </div>
                )}

                {openedWallet ? (
                  <Alert>
                    <Loader2 className="animate-spin" />
                    <AlertTitle>Finish in {openedWallet}</AlertTitle>
                    <AlertDescription>
                      After the {paySymbol} transfer confirms on BSC, this page updates automatically.
                    </AlertDescription>
                  </Alert>
                ) : null}

                {missingWallets.length > 0 ? (
                  <div className="pt-1">
                    <button
                      type="button"
                      className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                      onClick={() => setShowInstallList((v) => !v)}
                    >
                      {showInstallList ? 'Hide download options' : 'Need a wallet? Show download options'}
                    </button>
                    {showInstallList ? (
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {missingWallets.map((wallet) => (
                          <a
                            key={wallet.id}
                            href={
                              wallet.installUrl.startsWith('/')
                                ? `${window.location.origin}${wallet.installUrl}`
                                : wallet.installUrl
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-left text-xs text-ink-muted transition-colors hover:border-accent/40 hover:text-ink"
                          >
                            <span
                              className="grid size-7 place-items-center rounded-lg text-[9px] font-bold text-white"
                              style={{ backgroundColor: wallet.color }}
                            >
                              {wallet.glyph}
                            </span>
                            <span className="truncate font-medium">{wallet.name}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid min-w-0 gap-5 rounded-2xl border border-line bg-panel-elevated/30 p-4 sm:p-5 md:grid-cols-[180px_minmax(0,1fr)]">
                <div className="mx-auto w-fit rounded-2xl border border-line bg-white p-3">
                  <QRCodeSVG value={active.qrPayload ?? active.depositAddress} size={152} level="M" />
                  <p className="mt-2 flex items-center justify-center gap-1 text-[11px] text-ink-subtle">
                    <QrCode className="size-3" /> Scan to pay
                  </p>
                </div>
                <div className="min-w-0 space-y-4 text-sm">
                  <div>
                    <p className="text-xs font-medium text-ink-muted">Deposit address</p>
                    <p className="mt-1 break-all font-mono text-[11px] leading-relaxed text-ink sm:text-xs">
                      {active.depositAddress}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-muted">Exact amount</p>
                    <p className="mt-1 break-all font-mono text-sm font-semibold text-ink">
                      {active.amountUsdt} {paySymbol}
                    </p>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-accent-soft/40 px-3 py-2.5 text-xs text-ink-muted">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" />
                    <p>
                      Payments are matched automatically on BSC. Send the exact amount shown — do not
                      round it.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 border-t border-line pt-4">
                <p className="flex items-center gap-2 text-sm text-ink-muted">
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
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    disabled={checking}
                    onClick={() => void runPaymentCheck(txHashInput)}
                  >
                    {checking ? <Loader2 className="size-4 animate-spin" /> : null}
                    {checking ? 'Checking…' : 'I paid — check now'}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full sm:w-auto"
                    disabled={checking}
                    onClick={dismissActive}
                  >
                    Cancel / new deposit
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {!active?.depositAddress ? (
        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Deposit amount</CardTitle>
              <CardDescription>
                USDT converts to VFXT at the admin price and credits Fund Wallet. VFXT deposits credit
                Fund Wallet 1:1 in tokens.
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
                          body: 'Converts to VFXT in Fund Wallet',
                        },
                        {
                          id: 'VFXT' as const,
                          title: 'VFXT token',
                          body: 'Credits Fund Wallet in VFXT',
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
                        Min {minVfxtTokens.toLocaleString()} VFXT. Credits Fund Wallet 1:1 in tokens
                        {previewFundTokens > 0
                          ? ` · this amount → ${previewFundTokens.toLocaleString()} VFXT`
                          : ''}
                        .
                      </>
                    ) : (
                      <>
                        Min deposit ${(minDepositCents / 100).toFixed(2)}. Converts at{' '}
                        {tokensPerUsd.toLocaleString()} VFXT / $1. Example:{' '}
                        <span className="font-semibold text-ink">100 USDT</span> →{' '}
                        <span className="font-semibold text-ink">
                          {(100 * tokensPerUsd).toLocaleString()} VFXT
                        </span>{' '}
                        Fund Wallet
                        {previewFundTokens > 0 ? (
                          <>
                            . This amount →{' '}
                            <span className="font-semibold text-ink">
                              {previewFundTokens.toLocaleString()} VFXT
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
                body: 'USDT converts to VFXT at the admin price. VFXT credits tokens 1:1.',
              },
              {
                title: 'Open wallet & pay',
                body: 'Connect your wallet to send, or pick MetaMask / Trust with amount filled in.',
              },
              {
                title: 'Fund Wallet credit',
                body: 'Verified payments credit VFXT to Fund Wallet — ready to stake.',
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
