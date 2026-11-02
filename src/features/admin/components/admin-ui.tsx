import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function StatusTabs<T extends string>({
  value,
  onChange,
  options,
  layoutId,
}: {
  value: T
  onChange: (value: T) => void
  options: { value: T; label: string }[]
  layoutId: string
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-panel-elevated p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'relative rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
            value === option.value ? 'text-ink' : 'text-ink-muted hover:text-ink',
          )}
        >
          {value === option.value ? (
            <motion.span
              layoutId={layoutId}
              className="absolute inset-0 rounded-lg bg-panel shadow-xs"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          ) : null}
          <span className="relative">{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export function IdCell({ id, label }: { id: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(id)
        toast.success(`${label ?? 'ID'} copied`)
      }}
      className="group inline-flex items-center gap-1.5 rounded-md font-mono text-xs text-ink-muted transition-colors hover:text-ink"
      title={id}
    >
      {id.length > 14 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id}
      <Copy className="size-3 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

/** Prefer name/email; fall back to short id with copy. */
export function UserCell({
  userId,
  email,
  displayName,
}: {
  userId?: string | null
  email?: string | null
  displayName?: string | null
}) {
  const id = String(userId ?? '').trim()
  const name = String(displayName ?? '').trim()
  const mail = String(email ?? '').trim()
  const primary = name || mail || null
  if (!id && !primary) return <span className="text-ink-muted">—</span>
  return (
    <div className="min-w-0">
      {primary ? <p className="truncate text-sm font-medium text-ink">{primary}</p> : null}
      {mail && name ? <p className="truncate text-xs text-ink-muted">{mail}</p> : null}
      {id ? (
        <IdCell id={id} label="User ID" />
      ) : null}
    </div>
  )
}

/** Turn system actor strings into short admin-friendly labels. */
export function formatActorLabel(raw: unknown): string {
  const v = String(raw ?? '').trim()
  if (!v) return '—'
  const map: Record<string, string> = {
    'system:crypto-monitor': 'Auto (on-chain)',
    'system:manual-credit': 'Manual credit',
    'system:auto-withdraw': 'Auto withdraw',
    'system:process-auto-withdrawals': 'Auto withdraw',
  }
  if (map[v]) return map[v]
  if (v.startsWith('system:')) {
    return v
      .slice('system:'.length)
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
  }
  if (v.length > 20) return `${v.slice(0, 6)}…${v.slice(-4)}`
  return v
}

export function ActorCell({ value }: { value: unknown }) {
  return <span className="text-sm text-ink-muted">{formatActorLabel(value)}</span>
}

export function StatusPill({ status }: { status: unknown }) {
  const s = String(status ?? '').toLowerCase()
  const tone =
    s === 'completed' || s === 'approved' || s === 'active'
      ? 'bg-emerald-500/10 text-emerald-700'
      : s === 'pending' || s === 'awaiting_payment'
        ? 'bg-amber-500/10 text-amber-800'
        : s === 'rejected' || s === 'failed' || s === 'cancelled'
          ? 'bg-rose-500/10 text-rose-700'
          : 'bg-panel-elevated text-ink-muted'
  const label = s ? s.replaceAll('_', ' ') : '—'
  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize', tone)}>
      {label}
    </span>
  )
}

export function RejectDialog({
  open,
  onOpenChange,
  title,
  onConfirm,
  pending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onConfirm: (reason: string) => void
  pending: boolean
}) {
  const [reason, setReason] = useState('')
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('')
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          The reason is stored with the request and recorded in the audit log.
        </DialogDescription>
        <div className="mt-5 space-y-2">
          <Label htmlFor="reject-reason">Reason</Label>
          <Textarea
            id="reject-reason"
            className="min-h-24"
            placeholder="e.g. Payment not received"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={reason.trim().length < 3 || pending}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Reject request
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Admin enter/confirm how much Fund credit to apply (supports underpaid txs). */
export function ApproveDepositDialog({
  open,
  onOpenChange,
  pending,
  assetLabel,
  requestedLabel,
  observedLabel,
  reason,
  txHash,
  defaultAmount,
  amountHint,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pending: boolean
  assetLabel: string
  requestedLabel: string
  observedLabel?: string | null
  reason?: string | null
  txHash?: string | null
  /** Prefill in human units (USDT dollars or VFXT tokens). */
  defaultAmount: string
  amountHint: string
  onConfirm: (humanAmount: string) => void
}) {
  const [amount, setAmount] = useState(defaultAmount)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) setAmount(defaultAmount)
        else setAmount('')
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogTitle>Approve deposit — credit amount</DialogTitle>
        <DialogDescription>
          Enter how much to credit for this {assetLabel} payment. Use the observed on-chain amount
          when the member underpaid.
        </DialogDescription>
        <div className="mt-4 space-y-3 text-sm">
          <p>
            <span className="text-ink-muted">Requested:</span>{' '}
            <span className="font-medium text-ink">{requestedLabel}</span>
          </p>
          {observedLabel ? (
            <p>
              <span className="text-ink-muted">Observed on-chain:</span>{' '}
              <span className="font-medium text-ink">{observedLabel}</span>
            </p>
          ) : null}
          {reason ? (
            <p className="rounded-lg bg-panel-elevated px-3 py-2 text-xs text-ink-muted">{reason}</p>
          ) : null}
          {txHash ? (
            <p className="break-all font-mono text-[11px] text-ink-muted">{txHash}</p>
          ) : null}
          <div className="space-y-2 pt-1">
            <Label htmlFor="approve-credit-amount">{amountHint}</Label>
            <Input
              id="approve-credit-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={defaultAmount}
            />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={amount.trim().length < 1 || pending}
            onClick={() => onConfirm(amount.trim())}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            Approve & credit
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
