import { Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { VFXT_TOKEN, shortAddress } from '@/lib/vfxt-token'
import { cn } from '@/lib/utils'

const facts = [
  { label: 'Name', value: VFXT_TOKEN.name },
  { label: 'Symbol', value: VFXT_TOKEN.symbol },
  { label: 'Supply', value: `${VFXT_TOKEN.supply} (${VFXT_TOKEN.supplyShort})` },
  {
    label: 'Address',
    value: VFXT_TOKEN.address,
    href: VFXT_TOKEN.explorerUrl,
    mono: true,
  },
  {
    label: 'Treasury',
    value: VFXT_TOKEN.treasury,
    href: VFXT_TOKEN.treasuryExplorerUrl,
    mono: true,
  },
] as const

async function copy(value: string, label: string) {
  await navigator.clipboard.writeText(value)
  toast.success(`${label} copied`)
}

export function TokenFactsGrid({ className }: { className?: string }) {
  return (
    <dl
      className={cn(
        'divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-card',
        className,
      )}
    >
      {facts.map((fact) => (
        <div
          key={fact.label}
          className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
        >
          <dt className="text-sm font-medium text-ink-muted">{fact.label}</dt>
          <dd className="flex min-w-0 items-center gap-2">
            {'href' in fact && fact.href ? (
              <a
                href={fact.href}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'min-w-0 truncate font-semibold text-ink hover:text-accent',
                  fact.mono && 'font-mono text-xs sm:text-sm',
                )}
                title={fact.value}
              >
                <span className="sm:hidden">{shortAddress(fact.value, 6)}</span>
                <span className="hidden sm:inline">{fact.value}</span>
              </a>
            ) : (
              <span className="font-semibold">{fact.value}</span>
            )}
            {'mono' in fact && fact.mono ? (
              <>
                <button
                  type="button"
                  aria-label={`Copy ${fact.label}`}
                  className="shrink-0 text-ink-subtle hover:text-ink"
                  onClick={() => void copy(fact.value, fact.label)}
                >
                  <Copy className="size-3.5" />
                </button>
                {'href' in fact && fact.href ? (
                  <a
                    href={fact.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${fact.label} on BscScan`}
                    className="shrink-0 text-ink-subtle hover:text-ink"
                  >
                    <ExternalLink className="size-3.5" />
                  </a>
                ) : null}
              </>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function TokenFactsStrip({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'grid gap-4 rounded-2xl border border-line bg-panel/80 p-5 sm:grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Name / Symbol</p>
        <p className="mt-1 font-display text-lg font-bold">
          {VFXT_TOKEN.name} / {VFXT_TOKEN.symbol}
        </p>
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Supply</p>
        <p className="mt-1 font-display text-lg font-bold">{VFXT_TOKEN.supplyShort}</p>
        <p className="text-xs text-ink-muted">{VFXT_TOKEN.supply}</p>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Contract</p>
        <a
          href={VFXT_TOKEN.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate font-mono text-sm font-semibold hover:text-accent"
          title={VFXT_TOKEN.address}
        >
          {shortAddress(VFXT_TOKEN.address, 6)}
        </a>
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Treasury</p>
        <a
          href={VFXT_TOKEN.treasuryExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 block truncate font-mono text-sm font-semibold hover:text-accent"
          title={VFXT_TOKEN.treasury}
        >
          {shortAddress(VFXT_TOKEN.treasury, 6)}
        </a>
      </div>
    </div>
  )
}
