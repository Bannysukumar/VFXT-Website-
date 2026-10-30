import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/shared/page-header'
import { registerSchema, type RegisterValues } from '@/features/auth/schemas'
import { lookupReferralCode } from '@/services/auth-service'
import {
  clearWalletSignupSession,
  completeWalletSignup,
  readWalletSignupSession,
} from '@/lib/wallet-auth'
import { AuthLayout, PasswordInput } from '@/features/auth/components/auth-layout'

export function WalletRegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const session = readWalletSignupSession()
  const address = (session?.address || params.get('address') || '').toLowerCase()
  const signupToken = session?.signupToken || ''

  const [uplinerName, setUplinerName] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      mobile: '',
      referralCode: params.get('ref') ?? '',
      walletAddress: address,
      password: '',
      confirmPassword: '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const referralCode = form.watch('referralCode')

  useEffect(() => {
    if (!address || !signupToken) {
      toast.error('Connect your wallet first to continue signup')
      navigate('/auth/login', { replace: true })
    }
  }, [address, signupToken, navigate])

  useEffect(() => {
    if (address) form.setValue('walletAddress', address)
  }, [address, form])

  useEffect(() => {
    const code = referralCode?.trim()
    if (!code || code.length < 4) {
      setUplinerName(null)
      setLookupError(null)
      return
    }
    let cancelled = false
    const t = window.setTimeout(async () => {
      setLookingUp(true)
      setLookupError(null)
      try {
        const res = await lookupReferralCode(code)
        if (!cancelled) {
          setUplinerName(res.displayName)
          form.setValue('referralCode', res.referralCode, { shouldValidate: true })
        }
      } catch (err) {
        if (!cancelled) {
          setUplinerName(null)
          setLookupError(err instanceof Error ? err.message : 'Invalid referral code')
        }
      } finally {
        if (!cancelled) setLookingUp(false)
      }
    }, 400)
    return () => {
      cancelled = true
      window.clearTimeout(t)
    }
  }, [referralCode, form])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!uplinerName) {
      toast.error('Enter a valid referral code')
      return
    }
    if (!signupToken || !address) {
      toast.error('Wallet session expired — connect again')
      navigate('/auth/login')
      return
    }
    try {
      await completeWalletSignup({
        signupToken,
        address,
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        mobile: values.mobile,
        referralCode: values.referralCode,
      })
      toast.success('Account created and wallet linked')
      navigate('/app', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Signup failed')
    }
  })

  return (
    <AuthLayout
      title="Complete wallet signup"
      description="Your wallet was verified. Fill in your details to create and link this account."
      footer={
        <>
          Wrong wallet?{' '}
          <button
            type="button"
            className="font-semibold text-brand underline-offset-2 hover:underline"
            onClick={() => {
              clearWalletSignupSession()
              navigate('/auth/login')
            }}
          >
            Connect a different one
          </button>
        </>
      }
    >
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-line bg-canvas px-3 py-3 text-sm">
        <Wallet className="mt-0.5 size-4 shrink-0 text-brand" />
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Linked wallet</p>
          <p className="mt-0.5 break-all font-mono text-xs font-semibold">{address || '—'}</p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="displayName">Full name</Label>
          <Input
            id="displayName"
            autoComplete="name"
            aria-invalid={Boolean(errors.displayName)}
            {...form.register('displayName')}
          />
          <FieldError message={errors.displayName?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...form.register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile</Label>
          <Input
            id="mobile"
            autoComplete="tel"
            placeholder="+91…"
            aria-invalid={Boolean(errors.mobile)}
            {...form.register('mobile')}
          />
          <FieldError message={errors.mobile?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="referralCode">Referral code</Label>
          <Input
            id="referralCode"
            aria-invalid={Boolean(errors.referralCode)}
            {...form.register('referralCode')}
          />
          {lookingUp ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Loader2 className="size-3 animate-spin" /> Checking upliner…
            </p>
          ) : uplinerName ? (
            <p className="flex items-center gap-1.5 text-xs text-accent">
              <CheckCircle2 className="size-3.5" /> Upliner: {uplinerName}
            </p>
          ) : lookupError ? (
            <p className="text-xs text-danger">{lookupError}</p>
          ) : null}
          <FieldError message={errors.referralCode?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            {...form.register('password')}
          />
          <FieldError message={errors.password?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm password</Label>
          <PasswordInput
            id="confirmPassword"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.confirmPassword)}
            {...form.register('confirmPassword')}
          />
          <FieldError message={errors.confirmPassword?.message} />
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Create account & link wallet
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Prefer email only? <Link to="/auth/register">Register without wallet</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
