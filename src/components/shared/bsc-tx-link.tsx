import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

/** BSC mainnet explorer URL for a transaction hash. */
export function bscScanTxUrl(txHash: string): string {
  const hash = txHash.trim()
  const clean = hash.startsWith('0x') ? hash : `0x${hash}`
  return `https://bscscan.com/tx/${clean}`
}

export function BscTxLink({
  txHash,
  className,
  compact = false,
}: {
  txHash: string | null | undefined
  className?: string
  compact?: boolean
}) {
  if (!txHash?.trim()) return <span className="text-ink-subtle">None</span>
  const hash = txHash.trim()
  const label = compact
    ? `${hash.slice(0, 10)}…${hash.slice(-6)}`
    : `${hash.slice(0, 14)}…${hash.slice(-8)}`

  return (
    <a
      href={bscScanTxUrl(hash)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'inline-flex max-w-full items-center gap-1 font-mono text-xs font-medium text-brand underline-offset-2 hover:underline',
        className,
      )}
      title="View on BscScan"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate">{label}</span>
      <ExternalLink className="size-3 shrink-0 opacity-70" />
    </a>
  )
}
