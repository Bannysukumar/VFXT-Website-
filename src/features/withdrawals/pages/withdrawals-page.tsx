import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { AlertTriangle, Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { AmountInputPrefix, ProcessSteps, SummaryRow } from '@/components/shared/process-steps'
import { RequestHistory } from '@/components/shared/request-history'
import { useAuth } from '@/features/auth/auth-context'
import { formatMinor, parseToMinor } from '@/lib/money'
import { images } from '@/lib/media'
import { fetchUserWallets, requestWithdrawal } from '@/services/wallet-service'
import { fetchMyWithdrawals } from '@/services/records-service'

const schema = z.object({
  amount: z.string().min(1, 'Amount required'),
  destination: z.string().min(5, 'Destination required').max(200),
  note: z.string().max(200).optional(),
})

type Values = z.infer<typeof schema>

function previewMinor(input: string) {
  try {
    return input ? Number(parseToMinor(input, 2)) : 0
  } catch {
    return 0
  }
}

export function WithdrawalsPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { amount: '', destination: '', note: '' },
  })
  const { errors } = form.formState
  const amountMinor = previewMinor(form.watch('amount'))

  const wallets = useQuery({
    queryKey: ['wallets', user?.uid],
    queryFn: () => fetchUserWallets(user!.uid),
    enabled: Boolean(user?.uid),
  })
  const withdrawalWallet =
    wallets.data?.find((w) => w.id.endsWith('_withdrawal') || w.kind === 'withdrawal') ??
    wallets.data?.find((w) => w.currency === 'USD')
  const available = withdrawalWallet?.availableMinor ?? 0
  const exceeds = withdrawalWallet ? amountMinor > available : false

  const history = useQuery({
    queryKey: ['my-withdrawals', user?.uid],
    queryFn: () => fetchMyWithdrawals(user!.uid, 10),
    enabled: Boolean(user?.uid),
  })

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const minor = Number(parseToMinor(values.amount, 2))
      if (minor <= 0) throw new Error('Amount must be positive')
      return requestWithdrawal({
        amountMinor: minor,
        currency: 'USD',
        destination: values.destination,
        idempotencyKey: crypto.randomUUID(),
        note: values.note,
      })
    },
    onSuccess: async (res) => {
      const data = res as { status?: string; txHash?: string | null }
      if (data.status === 'completed' && data.txHash) {
        toast.success('USDT sent on BSC', { description: `Tx ${data.txHash.slice(0, 12)}…` })
      } else {
        toast.success('Withdrawal queued', {
          description: 'Hot wallet not ready — waiting for admin / funds.',
        })
      }
      form.reset()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['wallets'] }),
        queryClient.invalidateQueries({ queryKey: ['my-withdrawals'] }),
      ])
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const usdMoney = (minor: number) => formatMinor(minor, { scale: 2, currency: 'USD' })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Withdraw USDT"
        description="Enter amount and your BEP-20 wallet address. USDT is sent on BNB Smart Chain immediately when the hot wallet is configured."
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Send to wallet</CardTitle>
              <CardDescription>Debits your Withdrawal Wallet · USDT BEP-20 on BSC.</CardDescription>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2">
              <Wallet className="size-4 text-accent" />
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-ink-subtle">Available</p>
                <p className="tabular text-sm font-bold">{wallets.isLoading ? '…' : usdMoney(available)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={form.handleSubmit((values) => mutation.mutate(values))}>
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <AmountInputPrefix />
                  <Input
                    id="amount"
                    inputMode="decimal"
                    placeholder="0.00"
                    autoComplete="off"
                    className="tabular h-16 pl-11 pr-24 font-display text-2xl font-bold"
                    aria-invalid={Boolean(errors.amount) || exceeds}
                    {...form.register('amount')}
                  />
                  <button
                    type="button"
                    disabled={!withdrawalWallet}
                    onClick={() =>
                      form.setValue(
                        'amount',
                        (available / 10 ** (withdrawalWallet?.scale ?? 2)).toFixed(2),
                        { shouldValidate: true },
                      )
                    }
                    className="absolute inset-y-3 right-3 rounded-lg bg-accent-soft px-3 text-xs font-bold uppercase tracking-wide text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
                <FieldError message={errors.amount?.message} />
                {exceeds ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3.5" />
                    Amount exceeds your Withdrawal Wallet balance. Transfer earnings there first.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">BEP-20 wallet address</Label>
                <Input
                  id="destination"
                  placeholder="0x…"
                  className="font-mono text-sm"
                  aria-invalid={Boolean(errors.destination)}
                  {...form.register('destination')}
                />
                <FieldError message={errors.destination?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="note">
                  Note <span className="font-normal text-ink-subtle">(optional)</span>
                </Label>
                <Input id="note" placeholder="Reference for this withdrawal" {...form.register('note')} />
              </div>
              <div className="rounded-xl border border-line bg-canvas px-4 py-2">
                <SummaryRow label="Withdrawal amount" value={usdMoney(amountMinor)} />
                <SummaryRow label="Available after reserve" value={usdMoney(Math.max(available - amountMinor, 0))} />
                <div className="border-t border-line" />
                <SummaryRow strong label="You will receive" value={usdMoney(amountMinor)} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={mutation.isPending || exceeds}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : null}
                {mutation.isPending ? 'Sending…' : 'Withdraw USDT now'}
              </Button>
            </form>
          </CardContent>
        </Card>
        <ProcessSteps
          title="How withdrawals work"
          image={images.phoneAndLaptop}
          steps={[
            { title: 'Reserve', body: 'Amount is reserved in your Withdrawal Wallet.' },
            { title: 'On-chain send', body: 'Hot wallet transfers USDT BEP-20 to your address.' },
            { title: 'Confirmed', body: 'Ledger debit finalizes when the BSC transfer succeeds.' },
          ]}
        />
      </div>
      <RequestHistory
        kind="withdrawal"
        title="Your withdrawal requests"
        description="The 10 most recent withdrawals you have submitted."
        rows={history.data ?? []}
        loading={history.isLoading}
        error={history.isError ? history.error.message : undefined}
      />
    </div>
  )
}
