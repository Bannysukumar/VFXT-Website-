import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/shared/page-header'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { loginWithEmail } from '@/services/auth-service'
import { useAuth } from '@/features/auth/auth-context'
import { AuthLayout, PasswordInput } from '@/features/auth/components/auth-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { firebaseConfigured } = useAuth()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await loginWithEmail(values.email, values.password)
      toast.success('Welcome back')
      navigate(from, { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Sign-in failed')
    }
  })

  return (
    <AuthLayout
      title="Welcome back"
      description="Sign in to access your VFXT wallets and account."
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
