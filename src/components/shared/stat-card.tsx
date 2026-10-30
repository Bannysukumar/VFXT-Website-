import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CountUp } from '@/components/motion/reveal'

const tones = {
  accent: 'bg-accent-soft text-accent',
  warning: 'bg-warning/10 text-warning',
  info: 'bg-info/10 text-info',
  danger: 'bg-danger/10 text-danger',
  neutral: 'bg-panel-elevated text-ink-muted',
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'accent',
  index = 0,
  footer,
  format,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: LucideIcon
  tone?: keyof typeof tones
  index?: number
  footer?: ReactNode
  /** When `value` is a number, formats each animated frame (e.g. money from minor units). */
  format?: (n: number) => string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-2xl border border-line bg-panel p-5 shadow-card transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-ink-muted">{label}</p>
        <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-110', tones[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="tabular mt-3 font-display text-3xl font-bold tracking-tight">
        {typeof value === 'number' ? <CountUp value={value} format={format} duration={1.2} /> : value}
      </p>
      {hint ? <p className="mt-1 text-xs text-ink-subtle">{hint}</p> : null}
      {footer ? <div className="mt-4 border-t border-line pt-3">{footer}</div> : null}
    </motion.div>
  )
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-6">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="skeleton size-9 rounded-lg" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3 rounded" />
            <div className="skeleton h-3 w-1/5 rounded" />
          </div>
          <div className="skeleton h-4 w-20 rounded" />
        </div>
      ))}
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-panel p-5 shadow-card">
      <div className="flex justify-between">
        <div className="skeleton h-4 w-24 rounded" />
        <div className="skeleton size-10 rounded-xl" />
      </div>
      <div className="skeleton mt-4 h-8 w-32 rounded" />
      <div className="skeleton mt-2 h-3 w-20 rounded" />
    </div>
  )
}
