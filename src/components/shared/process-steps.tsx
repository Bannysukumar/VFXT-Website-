import type { ReactNode } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function ProcessSteps({
  title,
  steps,
  footer,
  image,
}: {
  title: string
  steps: { title: string; body: string }[]
  footer?: ReactNode
  image?: string
}) {
  return (
    <Card className="h-fit overflow-hidden">
      {image ? (
        <div className="relative h-36 overflow-hidden">
          <img src={image} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand/90 via-brand/40 to-transparent" />
          <p className="absolute bottom-4 left-6 font-display text-lg font-semibold text-white">{title}</p>
        </div>
      ) : (
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={image ? 'pt-6' : undefined}>
        <ol className="relative space-y-6 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-line-strong">
          {steps.map((step, i) => (
            <li key={step.title} className="relative flex gap-4">
              <span className="relative grid size-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-bold text-white ring-4 ring-panel">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        {footer ? <div className="mt-6">{footer}</div> : null}
      </CardContent>
    </Card>
  )
}

export function AmountInputPrefix() {
  return (
    <span className="pointer-events-none absolute inset-y-0 left-0 grid w-11 place-items-center text-lg font-semibold text-ink-muted">
      $
    </span>
  )
}

export function SummaryRow({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <span className="text-ink-muted">{label}</span>
      <span className={strong ? 'tabular font-display text-lg font-bold' : 'tabular font-medium'}>{value}</span>
    </div>
  )
}
