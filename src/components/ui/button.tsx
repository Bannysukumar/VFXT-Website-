import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/20 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-brand text-white shadow-xs hover:bg-brand-soft',
        accent:
          'bg-accent text-white shadow-[0_1px_2px_rgb(14_159_110/0.3),inset_0_1px_0_rgb(255_255_255/0.15)] hover:bg-accent-strong',
        secondary: 'bg-panel-elevated text-ink hover:bg-line',
        outline: 'border border-line-strong bg-panel text-ink shadow-xs hover:bg-panel-elevated',
        ghost: 'text-ink-muted hover:bg-panel-elevated hover:text-ink',
        danger: 'bg-danger text-white shadow-xs hover:bg-danger/90',
        link: 'h-auto px-0 text-accent underline-offset-4 hover:underline',
        light: 'bg-white text-brand shadow-xs hover:bg-white/90',
        glass: 'border border-white/20 bg-white/5 text-white backdrop-blur hover:bg-white/10',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-8 rounded-md px-3 text-xs',
        lg: 'h-12 px-6 text-[15px]',
        icon: 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  },
)
Button.displayName = 'Button'
