import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-hidden="true" className={cn('size-8', className)}>
      <rect width="32" height="32" rx="8" fill="#0a1915" />
      <path
        d="M7.5 21.5 13 11l4.5 7.5 3-5 4 8"
        stroke="#34d399"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24.5" cy="10" r="2" fill="#c6f56f" />
    </svg>
  )
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={inverted ? 'rounded-lg ring-1 ring-white/15' : undefined} />
      <span
        className={cn(
          'font-display text-lg font-bold tracking-tight',
          inverted ? 'text-white' : 'text-ink',
        )}
      >
        VFXT
      </span>
    </span>
  )
}
