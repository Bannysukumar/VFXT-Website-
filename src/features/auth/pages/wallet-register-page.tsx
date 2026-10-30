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
import { walletSignupSchema, type WalletSignupValues } from '@/features/auth/schemas'
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

  const prefilledRef =
    params.get('ref')?.trim() || session?.referralCode?.trim() || ''

  const form = useForm<WalletSignupValues>({
    resolver: zodResolver(walletSignupSchema),
    defaultValues: {
      displayName: '',
      mobile: '',
      referralCode: prefilledRef,
      email: '',
      password: '',
      confirmPassword: '',
      includeCredentials: false,
    },
  })
  const { errors, isSubmitting } = form.formState
  const referralCode = form.watch('referralCode')
  const includeCredentials = form.watch('includeCredentials')

  useEffect(() => {
    if (!address || !signupToken) {
      toast.error('Connect your wallet first to continue signup')
      navigate('/auth/login', { replace: true })
    }
  }, [address, signupToken, navigate])

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
      toast.error('A valid referral code is required to sign up')
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
        referralCode: values.referralCode,
        displayName: values.displayName?.trim() || undefined,
        mobile: values.mobile?.trim() || undefined,
        email: values.includeCredentials ? values.email?.trim() : undefined,
        password: values.includeCredentials ? values.password : undefined,
      })
      toast.success('Wallet account created')
      navigate('/app', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Signup failed')
    }
  })

  return (
    <AuthLayout
      title="Complete wallet signup"
      description="Referral code is required. Email and password are optional — you can skip them and sign in with this wallet later."
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
          <p className="text-xs font-medium text-ink-muted">Linked wallet</p>
          <p className="mt-0.5 break-all font-mono text-xs font-semibold">{address || '—'}</p>
        </div>
      </div>

      <form className="space-y-5" onSubmit={onSubmit} noValidate>
        <div className="space-y-2">
          <Label htmlFor="referralCode">
            Referral code <span className="text-danger">*</span>
          </Label>
          <Input
            id="referralCode"
            className="font-mono uppercase"
            aria-invalid={Boolean(errors.referralCode) || Boolean(lookupError)}
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
          ) : (
            <p className="text-xs text-ink-muted">You cannot create an account without a sponsor code.</p>
          )}
          <FieldError message={errors.referralCode?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Full name (optional)</Label>
          <Input
            id="displayName"
            autoComplete="name"
            aria-invalid={Boolean(errors.displayName)}
            {...form.register('displayName')}
          />
          <FieldError message={errors.displayName?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="mobile">Mobile (optional)</Label>
          <Input
            id="mobile"
            autoComplete="tel"
            placeholder="+91…"
            aria-invalid={Boolean(errors.mobile)}
            {...form.register('mobile')}
          />
          <FieldError message={errors.mobile?.message} />
        </div>

        <div className="rounded-xl border border-line bg-canvas/60 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">Email &amp; password</p>
              <p className="text-xs text-ink-muted">Optional. Skip it to use wallet-only login.</p>
            </div>
            <Button
              type="button"
              size="sm"
              variant={includeCredentials ? 'secondary' : 'outline'}
              onClick={() => {
                const next = !includeCredentials
                form.setValue('includeCredentials', next, { shouldValidate: true })
                if (!next) {
                  form.setValue('email', '')
                  form.setValue('password', '')
                  form.setValue('confirmPassword', '')
                  void form.clearErrors(['email', 'password', 'confirmPassword'])
                }
              }}
            >
              {includeCredentials ? 'Skip email & password' : 'Add email & password'}
            </Button>
          </div>

          {includeCredentials ? (
            <>
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
            </>
          ) : null}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isSubmitting || !uplinerName}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {includeCredentials ? 'Create account & link wallet' : 'Sign up with wallet'}
        </Button>
        <p className="text-center text-xs text-ink-muted">
          Prefer email only? <Link to="/auth/register">Register without wallet</Link>
        </p>
      </form>
    </AuthLayout>
  )
}
