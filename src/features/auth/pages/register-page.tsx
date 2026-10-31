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
import { finalizeRegistration, lookupReferralCode, registerWithEmail } from '@/services/auth-service'
import {
  loginWithWallet,
  readWalletSignupSession,
  saveWalletSignupSession,
  walletConnectConfigured,
} from '@/lib/wallet-auth'
import { AuthLayout, PasswordInput } from '@/features/auth/components/auth-layout'
import {
  DEFAULT_PHONE_COUNTRY,
  PhoneInput,
  composeMobile,
} from '@/features/auth/components/phone-input'

export function RegisterPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [uplinerName, setUplinerName] = useState<string | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [walletBusy, setWalletBusy] = useState(false)
  const [phoneCountry, setPhoneCountry] = useState(DEFAULT_PHONE_COUNTRY)
  const [nationalNumber, setNationalNumber] = useState('')

  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      mobile: '',
      referralCode: params.get('ref') ?? '',
      walletAddress: '',
      password: '',
      confirmPassword: '',
    },
  })
  const { errors, isSubmitting } = form.formState
  const referralCode = form.watch('referralCode')

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

  async function handleWalletConnect() {
    const code = form.getValues('referralCode')?.trim()
    if (!code || !uplinerName) {
      toast.error('Enter a valid referral code before connecting your wallet')
      return
    }
    setWalletBusy(true)
    try {
      const res = await loginWithWallet('walletconnect')
      if (res.kind === 'needs_signup') {
        const existing = readWalletSignupSession()
        if (existing) {
          saveWalletSignupSession({ ...existing, referralCode: code })
        }
        toast.message('Wallet verified — finish signup')
        const q = new URLSearchParams({
          address: res.address,
          ref: code,
        })
        navigate(`/auth/wallet-register?${q.toString()}`, { replace: true })
        return
      }
      if (res.needsProfile) {
        try {
          await finalizeRegistration({ referralCode: code })
          toast.success('Wallet connected and referral linked')
          navigate('/app', { replace: true })
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Could not link referral')
          navigate(`/auth/login`, { replace: true })
        }
        return
      }
      toast.success('Wallet connected')
      navigate('/app', { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Wallet connect failed')
    } finally {
      setWalletBusy(false)
    }
  }

  const onSubmit = form.handleSubmit(async (values) => {
    if (!uplinerName) {
      toast.error('Enter a valid referral code')
      return
    }
    const mobile = composeMobile(phoneCountry, nationalNumber)
    if (!mobile || mobile.replace(/\D/g, '').length < 8) {
      form.setError('mobile', { message: 'Enter a valid mobile number' })
      return
    }
    try {
      await registerWithEmail({
        email: values.email,
        password: values.password,
        displayName: values.displayName,
        mobile,
        referralCode: values.referralCode,
        walletAddress: values.walletAddress || undefined,
      })
      toast.success('Account created. Check your email to verify.')
      navigate('/app')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      description="Referral code is required. Connect with WalletConnect or register with email."
      footer={
        <>
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </>
      }
    >
      <div className="mb-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="referralCode">
            Referral code <span className="text-danger">*</span>
          </Label>
          <Input
            id="referralCode"
            placeholder="VFXT…"
            autoComplete="off"
            className="font-mono uppercase"
            aria-invalid={Boolean(errors.referralCode) || Boolean(lookupError)}
            {...form.register('referralCode')}
          />
          <FieldError message={errors.referralCode?.message ?? lookupError ?? undefined} />
          {lookingUp ? (
            <p className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Loader2 className="size-3.5 animate-spin" /> Checking sponsor…
            </p>
          ) : null}
          {uplinerName && !lookingUp ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 className="size-3.5" />
              Upliner: {uplinerName}
            </p>
          ) : null}
        </div>

        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={walletBusy || lookingUp || !uplinerName}
          onClick={() => void handleWalletConnect()}
        >
          {walletBusy ? <Loader2 className="animate-spin" /> : <Wallet className="size-4" />}
          WalletConnect
        </Button>
        {!walletConnectConfigured() ? (
          <p className="text-center text-[11px] text-ink-subtle">
            Set <code>VITE_WALLETCONNECT_PROJECT_ID</code> for QR wallet connect.
          </p>
        ) : (
          <p className="text-center text-[11px] text-ink-muted">
            After connecting, your referral code stays filled on the next step.
          </p>
        )}
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
          <Label htmlFor="displayName">Full name</Label>
          <Input
            id="displayName"
            autoComplete="name"
            placeholder="Jane Doe"
            aria-invalid={Boolean(errors.displayName)}
            {...form.register('displayName')}
          />
          <FieldError message={errors.displayName?.message} />
        </div>

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
          <Label htmlFor="mobile">Mobile number</Label>
          <PhoneInput
            id="mobile"
            countryCode={phoneCountry}
            onCountryChange={(code) => {
              setPhoneCountry(code)
              form.setValue('mobile', composeMobile(code, nationalNumber), {
                shouldValidate: Boolean(nationalNumber.trim()),
              })
            }}
            nationalNumber={nationalNumber}
            onNationalChange={(value) => {
              setNationalNumber(value)
              form.setValue('mobile', composeMobile(phoneCountry, value), {
                shouldValidate: true,
              })
              form.clearErrors('mobile')
            }}
            invalid={Boolean(errors.mobile)}
          />
          <FieldError message={errors.mobile?.message} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="walletAddress">
            Wallet address <span className="font-normal text-ink-subtle">(optional)</span>
          </Label>
          <Input
            id="walletAddress"
            placeholder="0x… BEP-20"
            className="font-mono text-sm"
            aria-invalid={Boolean(errors.walletAddress)}
            {...form.register('walletAddress')}
          />
          <FieldError message={errors.walletAddress?.message} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
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
        </div>

        <Button
          className="w-full"
          size="lg"
          type="submit"
          disabled={isSubmitting || !uplinerName || lookingUp}
        >
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-xs leading-relaxed text-ink-muted">
          By creating an account you agree to the <Link to="/legal/terms">Terms of Service</Link> and{' '}
          <Link to="/legal/privacy">Privacy Policy</Link>, and confirm you have read the{' '}
          <Link to="/legal/risk">Risk Disclosure</Link>.
        </p>
      </form>
    </AuthLayout>
  )
}
