import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type SuccessReceiptDetail = {
  label: string
  value: ReactNode
}

type SuccessReceiptProps = {
  title: string
  amount?: string
  subtitle?: string
  details?: SuccessReceiptDetail[]
  primaryAction: { label: string; onClick: () => void }
  secondaryAction?: { label: string; onClick: () => void }
  className?: string
}

/**
 * PhonePe / GPay style confirmation panel for completed money actions.
 */
export function SuccessReceipt({
  title,
  amount,
  subtitle,
  details,
  primaryAction,
  secondaryAction,
  className,
}: SuccessReceiptProps) {
  const reduceMotion = useReducedMotion()

  return (
    <Card
      className={cn(
        'overflow-hidden border-success/25 bg-gradient-to-b from-success/10 via-panel to-panel',
        className,
      )}
    >
      <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-10">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.55, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            reduceMotion
              ? { duration: 0 }
              : { type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }
          }
          className="relative grid size-24 place-items-center"
        >
          <span className="absolute inset-0 rounded-full bg-success/15" />
          {!reduceMotion ? (
            <motion.span
              aria-hidden
              className="absolute inset-[-6px] rounded-full border-2 border-success/25"
              initial={{ scale: 0.8, opacity: 0.7 }}
              animate={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 }}
            />
          ) : null}
          <span className="relative grid size-16 place-items-center rounded-full bg-success text-white shadow-lg shadow-success/25">
            <Check className="size-8 stroke-[2.5]" aria-hidden />
          </span>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { delay: 0.18, duration: 0.35 }}
          className="mt-6 space-y-2"
        >
          <p className="text-sm font-semibold text-success">Successful</p>
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {title}
          </h2>
          {amount ? (
            <p className="tabular pt-1 font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              {amount}
            </p>
          ) : null}
          {subtitle ? (
            <p className="mx-auto max-w-md text-sm text-ink-muted sm:text-base">{subtitle}</p>
          ) : null}
        </motion.div>

        {details && details.length > 0 ? (
          <motion.dl
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { delay: 0.28, duration: 0.3 }}
            className="mt-8 w-full max-w-md space-y-3 rounded-2xl border border-line bg-panel/80 px-4 py-4 text-left"
          >
            {details.map((row) => (
              <div
                key={row.label}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <dt className="text-ink-muted">{row.label}</dt>
                <dd className="max-w-[60%] break-all text-right font-medium text-ink">
                  {row.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        ) : null}

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { delay: 0.36, duration: 0.3 }}
          className="mt-8 flex w-full max-w-md flex-col gap-2 sm:flex-row sm:justify-center"
        >
          <Button size="lg" className="w-full sm:flex-1" onClick={primaryAction.onClick}>
            {primaryAction.label}
          </Button>
          {secondaryAction ? (
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:flex-1"
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          ) : null}
        </motion.div>
      </CardContent>
    </Card>
  )
}
