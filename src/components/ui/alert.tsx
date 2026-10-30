import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const alertVariants = cva(
  'relative grid w-full grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-xl border px-4 py-3.5 text-sm [&>:not(svg)]:col-start-2 [&>svg]:row-span-2 [&>svg]:mt-0.5 [&>svg]:size-4',
  {
    variants: {
      variant: {
        default: 'border-line bg-panel text-ink [&>svg]:text-accent',
        info: 'border-info/20 bg-info/5 text-ink [&>svg]:text-info',
        danger: 'border-danger/25 bg-danger/5 text-ink [&>svg]:text-danger',
        warning: 'border-warning/25 bg-warning/5 text-ink [&>svg]:text-warning',
        success: 'border-success/25 bg-success/5 text-ink [&>svg]:text-success',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export function Alert({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>) {
  return <div role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
}

export function AlertTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn('font-sans font-semibold leading-snug', className)} {...props} />
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn('text-sm leading-relaxed text-ink-muted', className)} {...props} />
}
