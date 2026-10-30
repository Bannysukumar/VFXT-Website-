import * as React from 'react'
import { cn } from '@/lib/utils'

export const fieldClasses =
  'w-full rounded-lg border border-field bg-panel px-3.5 text-sm text-ink shadow-xs transition-colors placeholder:text-ink-subtle hover:border-ink-muted focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:ring-danger/15'

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn('flex h-11 py-2', fieldClasses, className)}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea className={cn('min-h-32 py-3', fieldClasses, className)} ref={ref} {...props} />
    )
  },
)
Textarea.displayName = 'Textarea'

const chevron =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5.5 7.5l4.5 4.5 4.5-4.5' stroke='%2356685f' stroke-width='1.6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")"

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  ({ className, style, ...props }, ref) => {
    return (
      <select
        className={cn('h-11 cursor-pointer appearance-none pr-10', fieldClasses, className)}
        style={{
          backgroundImage: chevron,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 12px center',
          backgroundSize: '18px',
          ...style,
        }}
        ref={ref}
        {...props}
      />
    )
  },
)
NativeSelect.displayName = 'NativeSelect'
