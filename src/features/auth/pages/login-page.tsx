import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/shared/page-header'
import {
  loginSchema,
  walletCompleteSchema,
  type LoginValues,
  type WalletCompleteValues,
} from '@/features/auth/schemas'
import { finalizeRegistration, loginWithEmail, lookupReferralCode } from '@/services/auth-service'
import { loginWithWallet, walletConnectConfigured } from '@/lib/wallet-auth'
import { useAuth } from '@/features/auth/auth-context'
import { AuthLayout, PasswordInput } from '@/features/auth/components/auth-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { getFirebaseAuth } from '@/lib/firebase'

async function resolvePostLoginPath(fallback: string): Promise<string> {
  // Prefer returning to an explicit deep-link (e.g. /admin/users), otherwise
  // send admins to the console and members to the app.
  if (fallback.startsWith('/admin')) return fallback
  if (fallback.startsWith('/app') && fallback !== '/app') return fallback
  try {
    const user = getFirebaseAuth().currentUser
    if (!user) return fallback || '/app'
    const token = await user.getIdTokenResult(true)
    if (typeof token.claims.adminRole === 'string' && token.claims.adminRole) {
      return '/admin'
    }
  } catch {
    /* fall through */
  }
  return fallback && fallback !== '/app' ? fallback : '/app'
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { firebaseConfigured } = useAuth()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'
  const [walletBusy, setWalletBusy] = useState(false)
  const [needsProfile, setNeedsProfile] = useState(false)
  const [uplinerName, setUplinerName] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const completeForm = useForm<WalletCompleteValues>({
    resolver: zodResolver(walletCompleteSchema),
    defaultValues: { displayName: '', mobile: '', referralCode: '' },
  })
  const referralCode = completeForm.watch('referralCode')

  async function resolveUpliner(code: string) {
    if (!code || code.trim().length < 4) {
      setUplinerName(null)
      return
    }
    setLookingUp(true)
    try {
      const res = await lookupReferralCode(code.trim())
      setUplinerName(res.displayName)
      completeForm.setValue('referralCode', res.referralCode)
    } catch {
      setUplinerName(null)
    } finally {
      setLookingUp(false)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await loginWithEmail(values.email, values.password)
      toast.success('Welcome back')
      navigate(await resolvePostLoginPath(from), { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign-in failed')
    }
  })

  async function handleWalletConnect() {
    setWalletBusy(true)
    try {
      const res = await loginWithWallet('walletconnect')
      if (res.kind === 'needs_signup') {
        toast.message('New wallet — finish signup to link this address')
        navigate(
          `/auth/wallet-register?address=${encodeURIComponent(res.address)}`,
          { replace: true },
        )
        return
      }
      if (res.needsProfile) {
        setNeedsProfile(true)
        toast.message('Complete your profile to finish signup')
      } else {
        toast.success('Wallet connected')
        navigate(await resolvePostLoginPath(from), { replace: true })
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wallet login failed')
    } finally {
      setWalletBusy(false)
    }
  }

  const onCompleteProfile = completeForm.handleSubmit(async (values) => {
    if (!uplinerName) {
      toast.error('A valid referral code is required')
      return
    }
    try {
      await finalizeRegistration({
        referralCode: values.referralCode,
        mobile: values.mobile?.trim() || undefined,
        displayName: values.displayName?.trim() || undefined,
      })
      toast.success('Referral linked — welcome')
      navigate(await resolvePostLoginPath(from), { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not finish signup')
    }
  })

  if (needsProfile) {
    return (
      <AuthLayout
        title="Referral required"
        description="Enter a valid referral code to access your dashboard. Name and mobile are optional."
        footer={
          <>
            Prefer email? <Link to="/auth/register">Create an email account</Link>
          </>
        }
      >
        <form className="space-y-5" onSubmit={onCompleteProfile} noValidate>
          <div className="space-y-2">
            <Label htmlFor="referralCode">
              Referral code <span className="text-danger">*</span>
            </Label>
            <Input
              id="referralCode"
              className="font-mono uppercase"
              {...completeForm.register('referralCode', {
                onChange: (e) => void resolveUpliner(e.target.value),
              })}
            />
            {lookingUp ? (
              <p className="text-xs text-ink-muted">Checking sponsor…</p>
            ) : uplinerName ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-success">
                <CheckCircle2 className="size-3.5" /> Upliner: {uplinerName}
              </p>
            ) : referralCode?.trim().length >= 4 ? (
              <p className="text-xs text-danger">Referral code not found</p>
            ) : (
              <p className="text-xs text-ink-muted">You cannot continue without a sponsor code.</p>
            )}
            <FieldError message={completeForm.formState.errors.referralCode?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="displayName">Full name (optional)</Label>
            <Input id="displayName" {...completeForm.register('displayName')} />
            <FieldError message={completeForm.formState.errors.displayName?.message} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile number (optional)</Label>
            <Input id="mobile" type="tel" {...completeForm.register('mobile')} />
            <FieldError message={completeForm.formState.errors.mobile?.message} />
          </div>
          <Button
            className="w-full"
            size="lg"
            type="submit"
            disabled={completeForm.formState.isSubmitting || !uplinerName}
          >
            {completeForm.formState.isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Continue
          </Button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in with email & password or connect your wallet."
      footer={
        <>
          Don&apos;t have an account? <Link to="/auth/register">Create one</Link>
        </>
      }
    >
      {!firebaseConfigured ? (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle />
          <AlertTitle>Firebase not configured</AlertTitle>
          <AlertDescription>
            Copy <code>.env.example</code> to <code>.env.local</code> and set project values, or
            enable emulators.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-2">
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={walletBusy || !firebaseConfigured}
          onClick={() => void handleWalletConnect()}
        >
          {walletBusy ? <Loader2 className="animate-spin" /> : <Wallet className="size-4" />}
          WalletConnect
        </Button>
        {!walletConnectConfigured() ? (
          <p className="text-center text-[11px] text-ink-subtle">
            Set <code>VITE_WALLETCONNECT_PROJECT_ID</code> for QR wallet connect.
          </p>
        ) : null}
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-line" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-panel px-3 text-ink-subtle">or email</span>
        </div>
      </div>

      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={Boolean(errors.email)}
            {...form.register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/auth/reset" className="text-xs font-medium text-accent hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            aria-invalid={Boolean(errors.password)}
            {...form.register('password')}
          />
          <FieldError message={errors.password?.message} />
        </div>
        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
