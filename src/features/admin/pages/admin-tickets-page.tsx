import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Ticket } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { PageHeader } from '@/components/shared/page-header'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { IdCell, StatusTabs } from '@/features/admin/components/admin-ui'
import { cn } from '@/lib/utils'
import { updateTicketStatus } from '@/services/admin-service'
import { fetchTicketsByStatus } from '@/services/records-service'
import type { SupportTicket } from '@/types/models'

type TicketStatus = SupportTicket['status']

const tabs: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const priorityTone = { low: 'secondary', normal: 'info', high: 'danger' } as const

export function AdminTicketsPage() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<TicketStatus>('open')
  const [expanded, setExpanded] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['admin', 'tickets', status],
    queryFn: () => fetchTicketsByStatus(status),
  })

  const update = useMutation({
    mutationFn: ({ id, next }: { id: string; next: TicketStatus }) => updateTicketStatus(id, next),
    onSuccess: async () => {
      toast.success('Ticket updated')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin', 'tickets'] }),
        queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] }),
      ])
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const rows = query.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Support tickets" description="Triage user tickets and move them through the support workflow." />
      <StatusTabs value={status} onChange={setStatus} options={tabs} layoutId="ticket-tabs" />
      {query.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-2xl" />
          ))}
        </div>
      ) : query.isError ? (
        <Card>
          <ErrorState message={query.error.message} onRetry={() => query.refetch()} />
        </Card>
      ) : rows.length === 0 ? (
        <EmptyState icon={Ticket} title={`No ${status.replace('_', ' ')} tickets`} description="Tickets matching this status will appear here." />
      ) : (
        <div className="space-y-3">
          {rows.map((ticket) => {
            const isOpen = expanded === ticket.id
            return (
              <Card key={ticket.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-wrap items-center gap-4 p-5">
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : ticket.id)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                      aria-expanded={isOpen}
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                        <Ticket className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{ticket.subject}</p>
                        <p className="text-xs capitalize text-ink-muted">
                          {ticket.category} · updated {formatDistanceToNow(new Date(ticket.updatedAt), { addSuffix: true })}
                        </p>
                      </div>
                      <ChevronDown className={cn('ml-auto size-4 shrink-0 text-ink-subtle transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {ticket.priority ? (
                      <Badge variant={priorityTone[ticket.priority]} className="capitalize">
                        {ticket.priority}
                      </Badge>
                    ) : null}
                    <NativeSelect
                      aria-label="Change status"
                      className="h-9 w-40 text-xs"
                      value={ticket.status}
                      disabled={update.isPending}
                      onChange={(e) => update.mutate({ id: ticket.id, next: e.target.value as TicketStatus })}
                    >
                      {tabs.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden border-t border-line bg-canvas"
                      >
                        <div className="space-y-3 p-5">
                          <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.body}</p>
                          <p className="flex items-center gap-2 text-xs text-ink-muted">
                            User <IdCell id={ticket.userId} label="User ID" /> · Ticket <IdCell id={ticket.id} label="Ticket ID" />
                          </p>
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
