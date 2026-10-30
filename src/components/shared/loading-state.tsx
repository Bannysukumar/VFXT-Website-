import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function LoadingState({
  label = 'Loading…',
  className,
}: {
  label?: string
  className?: string
}) {
  return (
    <div
      className={cn('flex min-h-40 flex-col items-center justify-center gap-3 text-ink-muted', className)}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-6 animate-spin text-accent" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
