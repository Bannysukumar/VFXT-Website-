import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TypeText } from '@/components/motion/typing'

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string
  description?: ReactNode
  /** Accepted for compatibility; Hallmark drops eyebrows (Floor 9), so it is not rendered. */
  eyebrow?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[28px]">
          <TypeText text={title} speed={28} />
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs font-medium text-danger">{message}</p>
}
