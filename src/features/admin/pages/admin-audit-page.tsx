import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ScrollText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table'
import { PageHeader } from '@/components/shared/page-header'
import { SkeletonRows } from '@/components/shared/stat-card'
import { ErrorState } from '@/components/shared/error-state'
import { EmptyState } from '@/components/shared/empty-state'
import { IdCell } from '@/features/admin/components/admin-ui'
import { fetchAuditLogs } from '@/services/records-service'

function actionTone(action: string) {
  if (/reject|fail|revoke|suspend/i.test(action)) return 'danger' as const
  if (/approve|complete|credit|grant/i.test(action)) return 'success' as const
  if (/create|request/i.test(action)) return 'info' as const
  return 'secondary' as const
}

export function AdminAuditPage() {
  const query = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => fetchAuditLogs(100) })
  const rows = query.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance"
        title="Audit log"
        description="Immutable record of privileged actions. Visible to privileged and super admins."
      />
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {query.isLoading ? (
            <SkeletonRows rows={8} />
          ) : query.isError ? (
            <ErrorState title="Audit log unavailable" message={query.error.message} onRetry={() => query.refetch()} />
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={ScrollText} title="No audit entries" description="Privileged actions will be recorded here." />
            </div>
          ) : (
            <Table>
              <THead>
                <tr>
                  <TH>Time</TH>
                  <TH>Action</TH>
                  <TH>Resource</TH>
                  <TH>Resource ID</TH>
                  <TH>Actor</TH>
                </tr>
              </THead>
              <TBody>
                {rows.map((row) => (
                  <TR key={row.id}>
                    <TD className="whitespace-nowrap text-ink-muted">{format(new Date(row.createdAt), 'MMM d, yyyy · HH:mm:ss')}</TD>
                    <TD>
                      <Badge variant={actionTone(row.action)} className="font-mono text-[11px]">
                        {row.action}
                      </Badge>
                    </TD>
                    <TD className="capitalize">{row.resourceType.replaceAll('_', ' ') || '—'}</TD>
                    <TD>{row.resourceId ? <IdCell id={row.resourceId} label="Resource ID" /> : '—'}</TD>
                    <TD>{row.actorId ? <IdCell id={row.actorId} label="Actor ID" /> : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
