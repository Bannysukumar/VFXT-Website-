import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from 'firebase/auth'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getFirebaseAuth, isFirebaseReady } from '@/lib/firebase'

type Status = 'working' | 'verified' | 'reset' | 'error'

/**
 * Handles Firebase email-link actions on our domain:
 *   /auth/action?mode=verifyEmail&oobCode=…
 *   /auth/action?mode=resetPassword&oobCode=…
 *
 * Without this page, custom-domain action URLs land on the SPA and never
 * call applyActionCode — so emailVerified stays false forever and deposits 400.
 */
export function AuthActionPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const mode = params.get('mode') || ''
  const oobCode = params.get('oobCode') || ''
  const [status, setStatus] = useState<Status>('working')
  const [message, setMessage] = useState('Confirming…')
  const [email, setEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [saving, setSaving] = useState(false)

  const title = useMemo(() => {
    if (mode === 'verifyEmail') return 'Verify email'
    if (mode === 'resetPassword') return 'Reset password'
    return 'Account link'
  }, [mode])

  useEffect(() => {
    if (!isFirebaseReady()) {
      setStatus('error')
      setMessage('Firebase is not configured on this site.')
      return
    }
    if (!oobCode) {
      setStatus('error')
      setMessage('This link is missing a code. Open the latest email and try again.')
      return
    }

    const auth = getFirebaseAuth()
    let cancelled = false

    ;(async () => {
      try {
        if (mode === 'verifyEmail') {
          await applyActionCode(auth, oobCode)
          if (auth.currentUser) {
            await auth.currentUser.reload()
            await auth.currentUser.getIdToken(true)
          }
          if (cancelled) return
          setStatus('verified')
          setMessage('Your email is verified. You can deposit and withdraw now.')
          toast.success('Email verified')
          return
        }

        if (mode === 'resetPassword') {
          const mail = await verifyPasswordResetCode(auth, oobCode)
          if (cancelled) return
          setEmail(mail)
          setStatus('reset')
          setMessage(`Choose a new password for ${mail}`)
          return
        }

        // Unknown / recoverEmail — inspect then fail clearly.
        await checkActionCode(auth, oobCode)
        if (cancelled) return
        setStatus('error')
        setMessage('This link type is not supported here. Sign in and try again from the app.')
      } catch (err) {
        if (cancelled) return
        const raw = err instanceof Error ? err.message : 'Link expired or already used'
        setStatus('error')
        setMessage(
          /expired|invalid|already/i.test(raw)
            ? 'This link expired or was already used. Sign in and resend a new verification email.'
            : raw,
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [mode, oobCode])

  async function submitNewPassword(e: React.FormEvent) {
    e.preventDefault()
    if (!oobCode) return
    if (password.length < 8) {
      toast.error('Use at least 8 characters')
      return
    }
    if (password !== password2) {
      toast.error('Passwords do not match')
      return
    }
    setSaving(true)
    try {
      await confirmPasswordReset(getFirebaseAuth(), oobCode, password)
      toast.success('Password updated — sign in')
      navigate('/auth/login', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reset password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="container-page flex min-h-dvh items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === 'verified' ? (
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/app/deposits">Continue to deposit</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app">Go to dashboard</Link>
              </Button>
            </div>
          ) : null}

          {status === 'reset' && email ? (
            <form className="space-y-3" onSubmit={submitNewPassword}>
              <div className="space-y-1.5">
                <Label htmlFor="new-pass">New password</Label>
                <Input
                  id="new-pass"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-pass-2">Confirm password</Label>
                <Input
                  id="new-pass-2"
                  type="password"
                  autoComplete="new-password"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? 'Saving…' : 'Update password'}
              </Button>
            </form>
          ) : null}

          {status === 'error' ? (
            <div className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/auth/login">Back to sign in</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/app">Open app</Link>
              </Button>
            </div>
          ) : null}

          {status === 'working' ? (
            <p className="text-sm text-ink-muted">Please wait…</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
