import { useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { AlertTriangle, Loader2, Lock, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { AmountInputPrefix, ProcessSteps, SummaryRow } from '@/components/shared/process-steps'
import { RequestHistory } from '@/components/shared/request-history'
import { bscScanTxUrl } from '@/components/shared/bsc-tx-link'
import { useAuth } from '@/features/auth/auth-context'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import { formatMinor, parseToMinor } from '@/lib/money'
import { images } from '@/lib/media'
import { fetchUserWallets, requestWithdrawal } from '@/services/wallet-service'
import { fetchMyWithdrawals } from '@/services/records-service'
import { getPublicPlatformSettings } from '@/services/platform-service'
import { splitWithdrawalCommission } from '@/lib/plan'

const schema = z.object({
  amount: z.string().min(1, 'Amount required'),
  destination: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid BEP-20 address (0x…)'),
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
  const commissionBps = platform.data?.withdraw?.commissionBps ?? 0
  const { commissionMinor, netMinor } = splitWithdrawalCommission(amountMinor, commissionBps)

  const addressLocked = Boolean(lockedAddress.data)
  const destinationValue = form.watch('destination')

  useEffect(() => {
    if (lockedAddress.data) {
      form.setValue('destination', lockedAddress.data, { shouldValidate: true })
    }
  }, [lockedAddress.data, form])

  const withdrawalWallet =
    wallets.data?.find((w) => w.id.endsWith('_withdrawal') || w.kind === 'withdrawal') ??
    wallets.data?.find((w) => w.currency === 'USD')
  const available = withdrawalWallet?.availableMinor ?? 0
  const exceeds = withdrawalWallet ? amountMinor > available : false
  const belowMin = amountMinor > 0 && amountMinor < minWithdrawCents

  const history = useQuery({
    queryKey: ['my-withdrawals', user?.uid],
    queryFn: () => fetchMyWithdrawals(user!.uid, 10),
    enabled: Boolean(user?.uid),
  })

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const minor = Number(parseToMinor(values.amount, 2))
      if (minor <= 0) throw new Error('Amount must be positive')
      if (minor < minWithdrawCents) {
        throw new Error(`Minimum withdrawal is $${(minWithdrawCents / 100).toFixed(2)}`)
      }
      const destination = (lockedAddress.data || values.destination).trim()
      return requestWithdrawal({
        amountMinor: minor,
        currency: 'USD',
        destination,
        idempotencyKey: crypto.randomUUID(),
        note: values.note,
      })
    },
    onSuccess: async (res) => {
      const data = res as { status?: string; txHash?: string | null }
      if (data.status === 'completed' && data.txHash) {
        const hash = data.txHash
        toast.success('USDT sent on BSC', {
          description: `${hash.slice(0, 12)}…, open BscScan`,
          action: {
            label: 'BscScan',
            onClick: () => window.open(bscScanTxUrl(hash), '_blank', 'noopener,noreferrer'),
          },
        })
      } else {
        toast.success('Withdrawal queued', {
          description: 'Hot wallet not ready — waiting for admin / funds.',
        })
      }
      form.reset({
        amount: '',
        destination: lockedAddress.data || destinationValue || '',
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

  const usdMoney = (minor: number) => formatMinor(minor, { scale: 2, currency: 'USD' })

  return (
    <div className="space-y-8">
      <PageHeader
        title="Withdraw USDT"
        description="Enter amount and your BEP-20 wallet address. After your first successful withdrawal, that address is locked."
      />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="flex-row flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle>Send to wallet</CardTitle>
              <CardDescription>Debits your Withdrawal Wallet in USDT (BEP-20 on BSC).</CardDescription>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-line bg-canvas px-3.5 py-2">
              <Wallet className="size-4 text-accent" />
              <div>
                <p className="text-[11px] font-medium text-ink-subtle">Available</p>
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
                    className="absolute inset-y-3 right-3 rounded-lg bg-accent-soft px-3 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
                  >
                    Max
                  </button>
                </div>
                <FieldError message={errors.amount?.message} />
                <p className="text-xs text-ink-muted">
                  Min withdraw ${(minWithdrawCents / 100).toFixed(2)}
                  {commissionBps > 0
                    ? `, fee ${(commissionBps / 100).toFixed(2)}%`
                    : ''}
                </p>
                {exceeds ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3.5" />
                    Amount exceeds your Withdrawal Wallet balance. Transfer earnings there first.
                  </p>
                ) : null}
                {belowMin ? (
                  <p className="flex items-center gap-1.5 text-xs font-medium text-warning">
                    <AlertTriangle className="size-3.5" />
                    Below minimum withdrawal of ${(minWithdrawCents / 100).toFixed(2)}.
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="destination">BEP-20 wallet address</Label>
                {addressLocked ? (
                  <Alert>
                    <Lock />
                    <AlertTitle>Address locked</AlertTitle>
                    <AlertDescription>
                      This payout address was saved after your first successful withdrawal. Only an
                      admin can change it.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <p className="text-xs text-ink-muted">
                    First successful withdrawal saves this address to your profile. You will not be
                    able to change it afterward.
                  </p>
                )}
                <Input
                  id="destination"
                  placeholder="0x…"
                  className="font-mono text-sm"
                  readOnly={addressLocked}
                  disabled={addressLocked || lockedAddress.isLoading}
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
                {commissionBps > 0 ? (
                  <SummaryRow
                    label={`Commission (${(commissionBps / 100).toFixed(2)}%)`}
                    value={usdMoney(commissionMinor)}
                  />
                ) : null}
                <SummaryRow
                  label="Available after reserve"
                  value={usdMoney(Math.max(available - amountMinor, 0))}
                />
                <div className="border-t border-line" />
                <SummaryRow strong label="You will receive (on-chain)" value={usdMoney(netMinor)} />
              </div>
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={mutation.isPending || exceeds || belowMin || lockedAddress.isLoading}
              >
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
            {
              title: 'Address locked',
              body: 'After the first success, that wallet is saved and only an admin can change it.',
            },
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
