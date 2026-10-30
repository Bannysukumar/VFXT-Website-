import { useEffect } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { UserCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, FieldError } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { useAuth } from '@/features/auth/auth-context'
import { getDb, getFirebaseAuth, isFirebaseReady } from '@/lib/firebase'
import { updateProfile } from '@/services/user-service'
import { updateProfile as updateAuthProfile } from 'firebase/auth'

const schema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
  withdrawalAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid BEP-20 address (0x…)')
    .or(z.literal('')),
})

type Values = z.infer<typeof schema>

async function fetchProfileFields(uid: string) {
  if (!isFirebaseReady()) return { withdrawalAddress: '' }
  const snap = await getDoc(doc(getDb(), 'users', uid))
  const data = snap.data()
  return {
    withdrawalAddress: (data?.withdrawalAddress as string | undefined) ?? '',
  }
}

export function ProfilePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const profileQuery = useQuery({
    queryKey: ['my-profile', user?.uid],
    queryFn: () => fetchProfileFields(user!.uid),
    enabled: Boolean(user?.uid),
  })

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: user?.displayName ?? '', withdrawalAddress: '' },
  })

  const { errors, isSubmitting } = form.formState

  useEffect(() => {
    if (user?.displayName) form.setValue('displayName', user.displayName)
  }, [user?.displayName, form])

  useEffect(() => {
    if (profileQuery.data) {
      form.setValue('withdrawalAddress', profileQuery.data.withdrawalAddress)
    }
  }, [profileQuery.data, form])

  const save = useMutation({
    mutationFn: async (values: Values) => {
      const withdrawalAddress = values.withdrawalAddress.trim() || null
      await updateProfile({
        displayName: values.displayName.trim(),
        withdrawalAddress,
      })
      const auth = getFirebaseAuth()
      if (auth.currentUser) {
        await updateAuthProfile(auth.currentUser, { displayName: values.displayName.trim() })
      }
    },
    onSuccess: async () => {
      toast.success('Profile saved')
      await queryClient.invalidateQueries({ queryKey: ['my-profile'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const onSubmit = form.handleSubmit((values) => save.mutate(values))

  if (profileQuery.isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Update how you appear in the app and where USDT withdrawals are sent."
      />

      <Alert>
        <UserCircle />
        <AlertTitle>Auto-withdraw</AlertTitle>
        <AlertDescription>
          After your first successful withdrawal, the platform may auto-submit future withdrawals to
          your saved address when your balance meets the minimum, if auto-withdraw is enabled by
          admins.
        </AlertDescription>
      </Alert>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Your details</CardTitle>
          <CardDescription>Email: {user?.email ?? '—'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input id="displayName" aria-invalid={Boolean(errors.displayName)} {...form.register('displayName')} />
              <FieldError message={errors.displayName?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdrawalAddress">Withdrawal address (BEP-20)</Label>
              <Input
                id="withdrawalAddress"
                placeholder="0x…"
                className="font-mono text-sm"
                aria-invalid={Boolean(errors.withdrawalAddress)}
                {...form.register('withdrawalAddress')}
              />
              <FieldError message={errors.withdrawalAddress?.message} />
              <p className="text-xs text-ink-subtle">USDT on BSC only. Double-check before saving.</p>
            </div>
            <Button type="submit" disabled={isSubmitting || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
