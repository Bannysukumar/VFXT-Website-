import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { FieldError } from '@/components/shared/page-header'
import { resetSchema, type ResetValues } from '@/features/auth/schemas'
import { resetPassword } from '@/services/auth-service'
import { AuthLayout } from '@/features/auth/components/auth-layout'

export function ResetPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await resetPassword(values.email)
      setSentTo(values.email)
      toast.success('Password reset email sent')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Request failed')
    }
  })

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your account email and we'll send you a secure recovery link."
      footer={
        <Link to="/auth/login" className="inline-flex items-center gap-1.5 font-medium text-accent hover:underline">
          <ArrowLeft className="size-4" />
          Back to sign in
        </Link>
      }
    >
      {sentTo ? (
        <Alert variant="success" className="mb-6">
          <MailCheck />
          <AlertTitle>Check your inbox</AlertTitle>
          <AlertDescription>
            If an account exists for <strong className="text-ink">{sentTo}</strong>, a reset link
            is on its way.
          </AlertDescription>
        </Alert>
      ) : null}
      <form
        className="space-y-5"
        method="post"
        action="#"
        onSubmit={(event) => {
          event.preventDefault()
          void onSubmit(event)
        }}
        noValidate
      >
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
        <Button className="w-full" size="lg" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="animate-spin" /> : null}
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
