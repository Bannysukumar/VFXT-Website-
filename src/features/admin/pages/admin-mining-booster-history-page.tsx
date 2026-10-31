import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { adminListBoosterHistory } from '@/services/admin-service'

export function AdminMiningBoosterHistoryPage() {
  const [status, setStatus] = useState<string>('all')
  const history = useQuery({
    queryKey: ['admin', 'boosters', 'history', status],
    queryFn: () =>
      adminListBoosterHistory({
        status: status === 'all' ? undefined : status,
        limit: 100,
      }),
  })

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Wallet mining"
        title="Booster history"
        description="All booster purchases. Activated means USDT payment was verified on BSC."
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters">Booster catalog</Link>
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link to="/admin/mining/boosters/active">Active boosters</Link>
        </Button>
        <NativeSelect
          className="w-48"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="awaiting_payment">Awaiting payment</option>
          <option value="activated">Activated</option>
          <option value="expired_unpaid">Expired unpaid</option>
          <option value="cancelled">Cancelled</option>
        </NativeSelect>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-sans text-lg">Purchases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.isLoading ? (
            <LoadingState />
          ) : history.isError ? (
            <ErrorState message={history.error.message} onRetry={() => history.refetch()} />
          ) : (history.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-ink-muted">No booster purchases yet.</p>
          ) : (
            history.data!.items.map((row) => (
              <div
                key={row.purchaseId}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-3 text-sm last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {row.boosterName}{' '}
                    <Badge variant="secondary">{row.status}</Badge>
                  </p>
                  <p className="text-ink-muted">
                    +{row.bonusRatePerHour} VFXT/h · {row.priceUsdt} USDT
                  </p>
                  <p className="font-mono text-xs text-ink-muted">{row.walletAddress}</p>
                  <p className="font-mono text-xs text-ink-muted">{row.userId}</p>
                  {row.transactionHash ? (
                    <a
                      className="font-mono text-xs text-primary underline"
                      href={`https://bscscan.com/tx/${row.transactionHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {row.transactionHash.slice(0, 18)}…
                    </a>
                  ) : null}
                </div>
                <div className="text-right text-xs text-ink-muted">
                  {row.createdAtMillis
                    ? new Date(row.createdAtMillis).toLocaleString()
                    : '—'}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
