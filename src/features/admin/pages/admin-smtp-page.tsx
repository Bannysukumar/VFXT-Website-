import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Mail, Save, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  getAdminSmtpSettings,
  testSmtpSettings,
  updateSmtpSettings,
  type SmtpAdminSettings,
} from '@/services/admin-service'

function ToggleRow(props: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-border/70 px-3 py-3">
      <span>
        <span className="block text-sm font-medium text-ink">{props.label}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{props.description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-accent"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
    </label>
  )
}

export function AdminSmtpPage() {
  const queryClient = useQueryClient()
  const settings = useQuery({
    queryKey: ['admin', 'smtp-settings'],
    queryFn: getAdminSmtpSettings,
  })

  const [enabled, setEnabled] = useState(false)
  const [host, setHost] = useState('')
  const [port, setPort] = useState('587')
  const [secure, setSecure] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fromEmail, setFromEmail] = useState('support@virtualfxtrades.com')
  const [fromName, setFromName] = useState('Virtual FX Trades')
  const [replyTo, setReplyTo] = useState('support@virtualfxtrades.com')
  const [sendWelcome, setSendWelcome] = useState(true)
  const [sendWithdrawalStatus, setSendWithdrawalStatus] = useState(true)
  const [sendPasswordReset, setSendPasswordReset] = useState(true)
  const [testTo, setTestTo] = useState('')
  const [passwordSet, setPasswordSet] = useState(false)

  useEffect(() => {
    const s = settings.data
    if (!s) return
    setEnabled(Boolean(s.enabled))
    setHost(String(s.host ?? ''))
    setPort(String(s.port ?? 587))
    setSecure(Boolean(s.secure))
    setUsername(String(s.username ?? ''))
    setPassword('')
    setFromEmail(String(s.fromEmail || 'support@virtualfxtrades.com'))
    setFromName(String(s.fromName || 'Virtual FX Trades'))
    setReplyTo(String(s.replyTo || 'support@virtualfxtrades.com'))
    setSendWelcome(s.sendWelcome !== false)
    setSendWithdrawalStatus(s.sendWithdrawalStatus !== false)
    setSendPasswordReset(s.sendPasswordReset !== false)
    setPasswordSet(Boolean(s.passwordSet))
  }, [settings.data])

  const save = useMutation({
    mutationFn: updateSmtpSettings,
    onSuccess: async (next) => {
      toast.success('SMTP settings saved')
      setPassword('')
      setPasswordSet(Boolean(next.passwordSet))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'smtp-settings'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const test = useMutation({
    mutationFn: () => testSmtpSettings(testTo.trim() || undefined),
    onSuccess: (res) => toast.success(`Test email sent to ${res.to}`),
    onError: (e: Error) => toast.error(e.message),
  })

  const onSave = () => {
    const patch: Partial<SmtpAdminSettings> & { password?: string } = {
      enabled,
      host: host.trim(),
      port: Number.parseInt(port, 10) || 587,
      secure,
      username: username.trim(),
      fromEmail: fromEmail.trim(),
      fromName: fromName.trim(),
      replyTo: replyTo.trim(),
      sendWelcome,
      sendWithdrawalStatus,
      sendPasswordReset,
    }
    if (password.trim()) patch.password = password.trim()
    save.mutate(patch)
  }

  if (settings.isLoading) return <LoadingState />
  if (settings.isError) {
    return <ErrorState message={settings.error.message} onRetry={() => settings.refetch()} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Console"
        title="SMTP email"
        description="Send welcome, withdrawal status, and password-reset mail from support@virtualfxtrades.com."
      />

      <Alert>
        <Mail />
        <AlertTitle>Email service required</AlertTitle>
        <AlertDescription>
          You need SMTP credentials for <strong>support@virtualfxtrades.com</strong> (Google Workspace,
          Microsoft 365, cPanel/aaPanel mail, or a transactional provider like Brevo / SendGrid / SES).
          After DNS (SPF/DKIM) is set, paste host / username / password below and turn Enabled on.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">SMTP server</CardTitle>
          <CardDescription>
            Pre-filled From address is support@virtualfxtrades.com. Leave password blank to keep the
            saved secret{passwordSet ? ' (password is already stored)' : ''}.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-4">
          <ToggleRow
            label="Enabled"
            description="When off, no transactional emails are sent (password reset falls back to Firebase)."
            checked={enabled}
            onChange={setEnabled}
          />
          <div className="space-y-2">
            <Label>Host</Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.gmail.com or mail.virtualfxtrades.com"
              autoComplete="off"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Port</Label>
              <Input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                inputMode="numeric"
                placeholder="587"
              />
            </div>
            <div className="space-y-2">
              <Label>Encryption</Label>
              <NativeSelect
                value={secure ? '465' : '587'}
                onChange={(e) => {
                  const useSecure = e.target.value === '465'
                  setSecure(useSecure)
                  setPort(useSecure ? '465' : '587')
                }}
              >
                <option value="587">STARTTLS (587)</option>
                <option value="465">TLS / SSL (465)</option>
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="support@virtualfxtrades.com"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label>Password / app password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={passwordSet ? '•••••••• (leave blank to keep)' : 'SMTP password'}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label>From name</Label>
            <Input value={fromName} onChange={(e) => setFromName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>From email</Label>
            <Input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="support@virtualfxtrades.com"
            />
          </div>
          <div className="space-y-2">
            <Label>Reply-To</Label>
            <Input
              type="email"
              value={replyTo}
              onChange={(e) => setReplyTo(e.target.value)}
              placeholder="support@virtualfxtrades.com"
            />
          </div>
          <Button onClick={onSave} disabled={save.isPending}>
            <Save className="size-4" />
            {save.isPending ? 'Saving…' : 'Save SMTP settings'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Automatic emails</CardTitle>
          <CardDescription>Choose which events send mail when SMTP is enabled.</CardDescription>
        </CardHeader>
        <CardContent className="grid max-w-xl gap-3">
          <ToggleRow
            label="Welcome on registration"
            description="Sent when a new account with an email is created."
            checked={sendWelcome}
            onChange={setSendWelcome}
          />
          <ToggleRow
            label="Withdrawal success / fail"
            description="Sent when an automatic or admin withdrawal completes, fails, or is rejected."
            checked={sendWithdrawalStatus}
            onChange={setSendWithdrawalStatus}
          />
          <ToggleRow
            label="Password reset"
            description="Sends the reset link from your SMTP instead of Firebase’s default sender."
            checked={sendPasswordReset}
            onChange={setSendPasswordReset}
          />
          <Button variant="secondary" onClick={onSave} disabled={save.isPending}>
            <Save className="size-4" />
            Save email toggles
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Send test email</CardTitle>
          <CardDescription>Verifies the connection and delivers a short test message.</CardDescription>
        </CardHeader>
        <CardContent className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Destination</Label>
            <Input
              type="email"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
              placeholder="you@example.com (optional)"
            />
          </div>
          <Button onClick={() => test.mutate()} disabled={test.isPending || !enabled}>
            <Send className="size-4" />
            {test.isPending ? 'Sending…' : 'Send test'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
