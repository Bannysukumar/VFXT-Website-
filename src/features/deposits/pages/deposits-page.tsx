import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { QRCodeSVG } from 'qrcode.react'
import { CheckCircle2, Copy, Loader2, ShieldCheck } from 'lucide-react'
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
import { requestDeposit, type CreateDepositResult } from '@/services/wallet-service'
import { checkDepositPayment } from '@/services/crypto-service'
import { fetchMyDeposits } from '@/services/records-service'

const schema = z.object({
  amount: z.string().min(1, 'Amount required'),
  note: z.string().max(200).optional(),
})

type Values = z.infer<typeof schema>

const quickAmounts = ['100', '500', '1000', '5000']

function previewMinor(input: string) {
  try {
    return input ? Number(parseToMinor(input, 2)) : 0
  } catch {
    return 0
  }
}

export function DepositsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [active, setActive] = useState<CreateDepositResult | null>(null)
  const [payStatus, setPayStatus] = useState<string>('awaiting_payment')
  const [txHashInput, setTxHashInput] = useState('')
  const [checking, setChecking] = useState(false)

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

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const minor = Number(parseToMinor(values.amount, 2))
      if (minor <= 0) throw new Error('Amount must be positive')
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
        toast.success('Scan the QR and send USDT (BEP-20)')
      } else {
        toast.success('Deposit submitted for manual review')
      }
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['my-deposits'] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  async function runPaymentCheck(txHash?: string) {
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
        toast.success('Payment verified — Fund Wallet credited')
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['wallets'] }),
          queryClient.invalidateQueries({ queryKey: ['ledger'] }),
          queryClient.invalidateQueries({ queryKey: ['my-deposits'] }),
        ])
      } else {
        toast.message('Still waiting for the matching USDT transfer on BSC')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Check failed')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (!active?.depositId || payStatus === 'completed') return
    const id = window.setInterval(() => {
      void runPaymentCheck()
    }, 25_000)
    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- poll only while deposit is active
  }, [active?.depositId, payStatus])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Deposit USDT"
        description="Enter an amount, scan the QR, send USDT on BNB Smart Chain (BEP-20). We verify the transfer and credit your Fund Wallet automatically."
      />

      {active?.depositAddress ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>Send USDT (BEP-20)</CardTitle>
              <Badge variant={payStatus === 'completed' ? 'success' : 'warning'}>
                {payStatus === 'completed' ? 'Confirmed' : 'Waiting for payment'}
              </Badge>
            </div>
            <CardDescription>
              Network: {active.network} · Send this exact amount only (unique per request)
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-8 md:grid-cols-[220px_1fr]">
            <div className="mx-auto rounded-2xl border border-line bg-white p-4">
              {payStatus === 'completed' ? (
                <div className="grid size-48 place-items-center text-success">
                  <CheckCircle2 className="size-16" />
                </div>
              ) : (
                <QRCodeSVG value={active.qrPayload ?? active.depositAddress} size={192} level="M" />
              )}
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
                  account — even if others deposit the same dollar amount to the same address. Send
                  precisely {active.amountUsdt} USDT on BSC (BEP-20).
                </AlertDescription>
              </Alert>
              {payStatus !== 'completed' ? (
                <div className="space-y-3">
                  <p className="flex items-center gap-2 text-ink-muted">
                    <Loader2 className="size-4 animate-spin" />
                    Listening for your transaction…
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="txHash">Transaction hash (optional)</Label>
                    <Input
                      id="txHash"
                      placeholder="0x… paste from MetaMask / BscScan"
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
                    {checking ? 'Checking…' : 'Check payment now'}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setActive(null)}>Make another deposit</Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
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
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {quickAmounts.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => form.setValue('amount', value, { shouldValidate: true })}
                        className={cn(
                          'tabular rounded-lg border py-2 text-sm font-semibold transition-all',
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
                  {mutation.isPending ? 'Generating QR…' : 'Generate deposit QR'}
                </Button>
              </form>
            </CardContent>
          </Card>
          <ProcessSteps
            title="How crypto deposits work"
            image={images.tradingDesk}
            steps={[
              { title: 'Enter amount', body: 'We create a pending deposit for the exact USDT amount.' },
              { title: 'Scan & send', body: 'Pay USDT BEP-20 to the QR address from your wallet.' },
              { title: 'Auto credit', body: 'After on-chain confirmation, Fund Wallet updates automatically.' },
            ]}
          />
        </div>
      )}

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
