import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { parseToMinor } from '@/lib/money'
import { type WalletKind } from '@/lib/plan'
import { transferBetweenWallets } from '@/services/plan-service'

const ALLOWED: Array<{ from: WalletKind; to: WalletKind; label: string }> = [
  { from: 'daily_roi', to: 'withdrawal', label: 'Daily ROI → Withdrawal' },
  { from: 'level_income', to: 'withdrawal', label: 'Level income → Withdrawal' },
  { from: 'direct_referral', to: 'withdrawal', label: 'Direct referral VFXT → Withdrawal (USD)' },
  { from: 'direct_referral', to: 'staking', label: 'Direct referral VFXT → Staking (USD)' },
]

const schema = z.object({
  route: z.string().min(1),
  amount: z.string().min(1),
})

type Values = z.infer<typeof schema>

export function TransferPage() {
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { route: 'daily_roi:withdrawal', amount: '' },
  })

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const [fromKind, toKind] = values.route.split(':') as [WalletKind, WalletKind]
      const scale = fromKind === 'direct_referral' || fromKind === 'vfxt' ? 0 : 2
      const amountMinor = Number(parseToMinor(values.amount, scale))
      if (amountMinor <= 0) throw new Error('Amount must be positive')
      return transferBetweenWallets({
        fromKind,
        toKind,
        amountMinor,
        idempotencyKey: crypto.randomUUID(),
      })
    },
    onSuccess: async () => {
      toast.success('Transfer completed')
      form.reset({ route: form.getValues('route'), amount: '' })
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
      await queryClient.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-4xl">Transfer</h1>
        <p className="text-ink-muted">Move earnings into your Withdrawal Wallet before cashing out.</p>
      </div>
      <Alert>
        <AlertTitle>Allowed routes only</AlertTitle>
        <AlertDescription>
          Staking is opened from the Staking page (Fund → position). Withdrawals debit the Withdrawal
          Wallet only.
        </AlertDescription>
      </Alert>
      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Internal transfer</CardTitle>
          <CardDescription>Server-validated; idempotent.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((v) => mutation.mutate(v))}
          >
            <div className="space-y-2">
              <Label htmlFor="route">Route</Label>
              <select
                id="route"
                className="flex h-10 w-full rounded-md border border-line bg-panel px-3 text-sm"
                {...form.register('route')}
              >
                {ALLOWED.map((r) => (
                  <option key={`${r.from}:${r.to}`} value={`${r.from}:${r.to}`}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" inputMode="decimal" {...form.register('amount')} />
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Transferring…' : 'Transfer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
