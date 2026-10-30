import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-40 flex-col items-center justify-center gap-3 px-4 py-10 text-center',
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="size-8 text-danger" />
      <div>
        <h3 className="font-sans text-base font-semibold text-ink">{title}</h3>
        {message ? <p className="mt-1 max-w-md text-sm text-ink-muted">{message}</p> : null}
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
