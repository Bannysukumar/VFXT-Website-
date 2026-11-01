import { zodResolver } from '@hookform/resolvers/zod'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { formatDistanceToNow } from 'date-fns'
import { Clock, Inbox, Loader2, MessageSquareText, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, PageHeader } from '@/components/shared/page-header'
import { useAuth } from '@/features/auth/auth-context'
import { getDb, isFirebaseReady } from '@/lib/firebase'
import { fetchMyTickets } from '@/services/records-service'
import type { SupportTicket } from '@/types/models'

const schema = z.object({
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(200),
  body: z.string().min(10, 'Please describe the issue in at least 10 characters').max(5000),
  category: z.enum(['account', 'deposit', 'withdrawal', 'technical', 'other']),
})

type Values = z.infer<typeof schema>

const ticketTone: Record<SupportTicket['status'], 'warning' | 'info' | 'success' | 'secondary'> = {
  open: 'warning',
  in_progress: 'info',
  resolved: 'success',
  closed: 'secondary',
}

const tips = [
  { icon: MessageSquareText, title: 'Be specific', body: 'Include amounts, dates, and any reference IDs.' },
  { icon: Clock, title: 'Track status', body: 'Ticket status is updated by support admins.' },
  { icon: ShieldCheck, title: 'Stay safe', body: 'We will never ask for your password.' },
]

export function SupportPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { subject: '', body: '', category: 'other' },
  })
  const { errors, isSubmitting } = form.formState
  const bodyLength = form.watch('body')?.length ?? 0

  const tickets = useQuery({
    queryKey: ['my-tickets', user?.uid],
    queryFn: () => fetchMyTickets(user!.uid),
    enabled: Boolean(user?.uid),
  })

  const onSubmit = form.handleSubmit(async (values) => {
    if (!user || !isFirebaseReady()) {
      toast.error('Not signed in or Firebase unavailable')
      return
    }
    try {
      await addDoc(collection(getDb(), 'supportTickets'), {
        userId: user.uid,
        subject: values.subject,
        body: values.body,
        category: values.category,
        status: 'open',
        priority: 'normal',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })
      toast.success('Ticket submitted', { description: 'Our team will get back to you soon.' })
      form.reset()
      await queryClient.invalidateQueries({ queryKey: ['my-tickets'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create ticket')
    }
  })

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="Support"
        description="Open a ticket for deposits, withdrawals, or account help. Track status below — we never ask for your password."
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>New ticket</CardTitle>
            <CardDescription>Tell us what you need help with.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={onSubmit} noValidate>
              <div className="grid gap-5 sm:grid-cols-[1.5fr_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" placeholder="Brief summary" aria-invalid={Boolean(errors.subject)} {...form.register('subject')} />
                  <FieldError message={errors.subject?.message} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <NativeSelect id="category" {...form.register('category')}>
                    <option value="account">Account</option>
                    <option value="deposit">Deposit</option>
                    <option value="withdrawal">Withdrawal</option>
                    <option value="technical">Technical</option>
                    <option value="other">Other</option>
                  </NativeSelect>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="body">Message</Label>
                  <span className="tabular text-xs text-ink-subtle">{bodyLength}/5000</span>
                </div>
                <Textarea id="body" placeholder="Describe the issue in detail…" aria-invalid={Boolean(errors.body)} {...form.register('body')} />
                <FieldError message={errors.body?.message} />
              </div>
              <Button type="submit" size="lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Submit ticket
              </Button>
            </form>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Tips for a fast resolution</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {tips.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-sm text-ink-muted">{body}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your tickets</CardTitle>
          <CardDescription>Most recently updated first.</CardDescription>
        </CardHeader>
        <CardContent>
          {tickets.isLoading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-16 rounded-xl" />
              ))}
            </div>
          ) : tickets.isError ? (
            <p className="text-sm text-danger">{tickets.error.message}</p>
          ) : (tickets.data ?? []).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <span className="grid size-12 place-items-center rounded-xl bg-panel-elevated text-ink-subtle">
                <Inbox className="size-5" />
              </span>
              <p className="text-sm font-medium">No tickets yet</p>
              <p className="text-xs text-ink-muted">Tickets you open will appear here.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {tickets.data!.map((ticket) => (
                <li key={ticket.id} className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:bg-panel-elevated/50">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{ticket.subject}</p>
                    <p className="text-xs capitalize text-ink-muted">
                      {ticket.category}, updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant={ticketTone[ticket.status]} className="capitalize">
                    <span className="size-1.5 rounded-full bg-current" />
                    {ticket.status.replace('_', ' ')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
