import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { parseToMinor } from '@/lib/money'
import { type WalletKind } from '@/lib/plan'
import {
  getAffiliateDashboard,
  lookupUserId,
  transferBetweenWallets,
  transferToUser,
} from '@/services/plan-service'
import { useAuth } from '@/features/auth/auth-context'

const ALLOWED: Array<{ from: WalletKind; to: WalletKind; label: string }> = [
  { from: 'daily_roi', to: 'withdrawal', label: 'Daily ROI → Withdrawal' },
  { from: 'level_income', to: 'withdrawal', label: 'Level income → Withdrawal' },
  { from: 'direct_referral', to: 'withdrawal', label: 'Direct referral VFXT → Withdrawal (USD)' },
  { from: 'direct_referral', to: 'staking', label: 'Direct referral VFXT → Staking (USD)' },
]

const internalSchema = z.object({
  route: z.string().min(1),
  amount: z.string().min(1),
})

const peerSchema = z.object({
  toUserId: z.string().min(4, 'Enter a user ID like VFXT2533'),
  walletKind: z.enum(['vfxt', 'withdrawal']),
  amount: z.string().min(1),
  note: z.string().max(200).optional(),
})

type InternalValues = z.infer<typeof internalSchema>
type PeerValues = z.infer<typeof peerSchema>

export function TransferPage() {
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const affiliate = useQuery({
    queryKey: ['affiliate', user?.uid],
    queryFn: getAffiliateDashboard,
    enabled: Boolean(user?.uid),
  })

  const internalForm = useForm<InternalValues>({
    resolver: zodResolver(internalSchema),
    defaultValues: { route: 'daily_roi:withdrawal', amount: '' },
  })

  const peerForm = useForm<PeerValues>({
    resolver: zodResolver(peerSchema),
    defaultValues: { toUserId: '', walletKind: 'vfxt', amount: '', note: '' },
  })

  const internalMutation = useMutation({
    mutationFn: async (values: InternalValues) => {
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
      internalForm.reset({ route: internalForm.getValues('route'), amount: '' })
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
      await queryClient.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const peerMutation = useMutation({
    mutationFn: async (values: PeerValues) => {
      const toUserId = values.toUserId.trim().toUpperCase()
      if (affiliate.data?.referralCode && toUserId === affiliate.data.referralCode.toUpperCase()) {
        throw new Error('Cannot transfer to yourself')
      }
      await lookupUserId(toUserId)
      const scale = values.walletKind === 'vfxt' ? 0 : 2
      const amountMinor = Number(parseToMinor(values.amount, scale))
      if (amountMinor <= 0) throw new Error('Amount must be positive')
      return transferToUser({
        toUserId,
        walletKind: values.walletKind,
        amountMinor,
        note: values.note?.trim() || undefined,
        idempotencyKey: crypto.randomUUID(),
      })
    },
    onSuccess: async (res) => {
      toast.success(`Sent to ${res.toUserId}`)
      peerForm.reset({
        toUserId: '',
        walletKind: peerForm.getValues('walletKind'),
        amount: '',
        note: '',
      })
      await queryClient.invalidateQueries({ queryKey: ['wallets'] })
      await queryClient.invalidateQueries({ queryKey: ['ledger'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const myId = affiliate.data?.referralCode

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Transfer</h1>
          <p className="text-ink-muted">
            Send to another member by User ID, or move earnings between your wallets.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/app/transfers/history">
            <History className="size-4" />
            Transfer history
          </Link>
        </Button>
      </div>

      {myId ? (
        <Alert>
          <AlertTitle>Your User ID</AlertTitle>
          <AlertDescription>
            Share <span className="font-mono font-semibold text-ink">{myId}</span> so others can
            send you funds. Referral link uses the same ID.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Send to user</CardTitle>
          <CardDescription>
            Transfer VFXT tokens or Withdrawal USD using their User ID (e.g. VFXT2533).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={peerForm.handleSubmit((v) => peerMutation.mutate(v))}
          >
            <div className="space-y-2">
              <Label htmlFor="toUserId">Recipient User ID</Label>
              <Input
                id="toUserId"
                placeholder="VFXT2533"
                className="font-mono uppercase"
                {...peerForm.register('toUserId')}
              />
              {peerForm.formState.errors.toUserId ? (
                <p className="text-xs text-danger">{peerForm.formState.errors.toUserId.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="walletKind">From wallet</Label>
              <select
                id="walletKind"
                className="flex h-10 w-full rounded-md border border-line bg-panel px-3 text-sm"
                {...peerForm.register('walletKind')}
              >
                <option value="vfxt">VFXT tokens</option>
                <option value="withdrawal">Withdrawal (USD)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="peer-amount">Amount</Label>
              <Input id="peer-amount" inputMode="decimal" {...peerForm.register('amount')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" maxLength={200} {...peerForm.register('note')} />
            </div>
            <Button type="submit" disabled={peerMutation.isPending}>
              {peerMutation.isPending ? 'Sending…' : 'Send to user'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Alert>
        <AlertTitle>Internal wallet moves</AlertTitle>
        <AlertDescription>
          Staking is opened from the Staking page (Fund → position). Withdrawals debit the Withdrawal
          Wallet only.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Internal transfer</CardTitle>
          <CardDescription>Move earnings into your Withdrawal Wallet before cashing out.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={internalForm.handleSubmit((v) => internalMutation.mutate(v))}
          >
            <div className="space-y-2">
              <Label htmlFor="route">Route</Label>
              <select
                id="route"
                className="flex h-10 w-full rounded-md border border-line bg-panel px-3 text-sm"
                {...internalForm.register('route')}
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
              <Input id="amount" inputMode="decimal" {...internalForm.register('amount')} />
            </div>
            <Button type="submit" disabled={internalMutation.isPending}>
              {internalMutation.isPending ? 'Transferring…' : 'Transfer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
