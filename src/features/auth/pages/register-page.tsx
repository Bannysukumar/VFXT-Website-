import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/shared/page-header'
import { registerSchema, type RegisterValues } from '@/features/auth/schemas'
import { registerWithEmail } from '@/services/auth-service'
import { AuthLayout, PasswordInput } from '@/features/auth/components/auth-layout'

export function RegisterPage() {
  const navigate = useNavigate()
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await registerWithEmail(values)
      toast.success('Account created. Check your email to verify.')
      navigate('/app')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Registration failed')
    }
  })

  return (
    <AuthLayout
      title="Create your account"
      description="Join Virtual FX Trades. We'll send a link to verify your email."
      footer={
        <>
          Already have an account? <Link to="/auth/login">Sign in</Link>
        </>
      }
    >
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
        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
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
