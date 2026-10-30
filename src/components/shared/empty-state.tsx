import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex min-h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-panel/60 px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-2 grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
        <Icon className="size-5" />
      </div>
      <h3 className="font-sans text-base font-semibold text-ink">{title}</h3>
      {description ? <p className="max-w-md text-sm text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  )
}
