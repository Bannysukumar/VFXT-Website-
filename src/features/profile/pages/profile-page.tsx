import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile as updateAuthProfile,
} from 'firebase/auth'
import { KeyRound, UserCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, FieldError } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { PasswordInput } from '@/features/auth/components/auth-layout'
import { useAuth } from '@/features/auth/auth-context'
import { getDb, getFirebaseAuth, isFirebaseReady } from '@/lib/firebase'
import { updateProfile } from '@/services/user-service'

const schema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(80),
})

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

type Values = z.infer<typeof schema>
type PasswordValues = z.infer<typeof passwordSchema>

async function fetchProfileFields(uid: string) {
  if (!isFirebaseReady()) return { withdrawalAddress: '' }
  const snap = await getDoc(doc(getDb(), 'users', uid))
  const data = snap.data()
  const raw =
    (typeof data?.withdrawalAddress === 'string' && data.withdrawalAddress) ||
    (typeof data?.walletAddress === 'string' && data.walletAddress) ||
    ''
  return {
    withdrawalAddress: raw,
  }
}

export function ProfilePage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [hasPasswordProvider, setHasPasswordProvider] = useState(true)

  const profileQuery = useQuery({
    queryKey: ['my-profile', user?.uid],
    queryFn: () => fetchProfileFields(user!.uid),
    enabled: Boolean(user?.uid),
  })

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: user?.displayName ?? '' },
  })

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const { errors, isSubmitting } = form.formState
  const passwordErrors = passwordForm.formState.errors
  const savedWithdrawalAddress = profileQuery.data?.withdrawalAddress?.trim() || ''

  useEffect(() => {
    if (user?.displayName) form.setValue('displayName', user.displayName)
  }, [user?.displayName, form])

  useEffect(() => {
    const auth = getFirebaseAuth()
    const providers = auth.currentUser?.providerData?.map((p) => p.providerId) ?? []
    setHasPasswordProvider(providers.includes('password') || Boolean(user?.email))
  }, [user?.email, user?.uid])

  const save = useMutation({
    mutationFn: async (values: Values) => {
      await updateProfile({
        displayName: values.displayName.trim(),
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

  const changePassword = useMutation({
    mutationFn: async (values: PasswordValues) => {
      const auth = getFirebaseAuth()
      const current = auth.currentUser
      if (!current?.email) {
        throw new Error('Your account has no email/password login to update')
      }
      const credential = EmailAuthProvider.credential(current.email, values.currentPassword)
      await reauthenticateWithCredential(current, credential)
      await updatePassword(current, values.newPassword)
    },
    onSuccess: () => {
      toast.success('Password updated')
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
    },
    onError: (e: Error) => {
      const msg = e.message || 'Could not update password'
      if (/wrong-password|invalid-credential|invalid-login/i.test(msg)) {
        toast.error('Current password is incorrect')
        return
      }
      if (/requires-recent-login/i.test(msg)) {
        toast.error('Please sign out and sign in again, then retry')
        return
      }
      toast.error(msg)
    },
  })

  const onSubmit = form.handleSubmit((values) => save.mutate(values))
  const onPasswordSubmit = passwordForm.handleSubmit((values) => changePassword.mutate(values))

  if (profileQuery.isLoading) return <LoadingState />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile"
        description="Update your display name and review the withdrawal address used for USDT payouts."
      />

      <Alert>
        <UserCircle />
        <AlertTitle>Withdrawal address</AlertTitle>
        <AlertDescription>
          After your first successful withdrawal, your payout address is saved for safety. Contact
          support if you ever need it updated.
        </AlertDescription>
      </Alert>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Your details</CardTitle>
          <CardDescription>Signed in as {user?.email ?? '—'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                aria-invalid={Boolean(errors.displayName)}
                {...form.register('displayName')}
              />
              <FieldError message={errors.displayName?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="withdrawalAddress">Withdrawal address (BEP-20)</Label>
              <Input
                id="withdrawalAddress"
                placeholder="Not set yet — set on first successful withdrawal"
                className="font-mono text-sm"
                value={savedWithdrawalAddress}
                readOnly
                disabled
              />
              <p className="text-xs text-ink-subtle">
                {savedWithdrawalAddress
                  ? 'Saved after your first successful withdrawal. Contact support to change it.'
                  : 'Saved automatically when your first withdrawal succeeds.'}
              </p>
            </div>
            <Button type="submit" disabled={isSubmitting || save.isPending}>
              {save.isPending ? 'Saving…' : 'Save profile'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4 text-accent" />
            Change password
          </CardTitle>
          <CardDescription>
            Update your login password. You must enter your current password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasPasswordProvider || !user?.email ? (
            <p className="text-sm text-ink-muted">
              This account has no email/password login. Ask an admin to set an email and password
              from the Users panel if you need one.
            </p>
          ) : (
            <form onSubmit={onPasswordSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <PasswordInput
                  id="currentPassword"
                  autoComplete="current-password"
                  aria-invalid={Boolean(passwordErrors.currentPassword)}
                  {...passwordForm.register('currentPassword')}
                />
                <FieldError message={passwordErrors.currentPassword?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <PasswordInput
                  id="newPassword"
                  autoComplete="new-password"
                  aria-invalid={Boolean(passwordErrors.newPassword)}
                  {...passwordForm.register('newPassword')}
                />
                <FieldError message={passwordErrors.newPassword?.message} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <PasswordInput
                  id="confirmPassword"
                  autoComplete="new-password"
                  aria-invalid={Boolean(passwordErrors.confirmPassword)}
                  {...passwordForm.register('confirmPassword')}
                />
                <FieldError message={passwordErrors.confirmPassword?.message} />
              </div>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
