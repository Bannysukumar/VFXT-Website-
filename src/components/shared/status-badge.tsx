import { Badge } from '@/components/ui/badge'
import type { TransactionStatus } from '@/types/models'

const variants: Record<TransactionStatus, 'success' | 'warning' | 'danger' | 'info' | 'secondary'> = {
  pending: 'warning',
  awaiting_payment: 'warning',
  approved: 'success',
  processing: 'info',
  completed: 'success',
  rejected: 'danger',
  cancelled: 'secondary',
  expired: 'secondary',
  failed: 'danger',
}

export function StatusBadge({ status }: { status: string }) {
  const variant = variants[status as TransactionStatus] ?? 'secondary'
  return (
    <Badge variant={variant} className="capitalize">
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  )
}
