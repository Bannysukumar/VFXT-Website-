import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { KeyRound, ShieldAlert, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { LoadingState } from '@/components/shared/loading-state'
import { ErrorState } from '@/components/shared/error-state'
import { getAdminCryptoWalletInfo, setCryptoHotWallet } from '@/services/crypto-service'
import {
  addCryptoHotWallet,
  listCryptoHotWallets,
  removeCryptoHotWallet,
  updateCryptoHotWallet,
} from '@/services/admin-service'
import { ApiError } from '@/services/api'

const PART_COUNT = 4
const PART_LEN = 16

function stripKeyNoise(value: string): string {
  let key = value
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '')
  if (key.toLowerCase().startsWith('0x')) key = key.slice(2)
  return key.replace(/[^0-9a-fA-F]/g, '')
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary)
}

function looksLikeHexPrivateKey(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(stripKeyNoise(value))
}

export function AdminCryptoWalletPage() {
  const queryClient = useQueryClient()
  const [parts, setParts] = useState<string[]>(() => Array.from({ length: PART_COUNT }, () => ''))
  const [rpcUrl, setRpcUrl] = useState('')
  const [poolParts, setPoolParts] = useState<string[]>(() => Array.from({ length: PART_COUNT }, () => ''))
  const [poolLabel, setPoolLabel] = useState('')
  const [poolRpcUrl, setPoolRpcUrl] = useState('')

  const combinedKey = useMemo(() => stripKeyNoise(parts.join('')), [parts])

  const info = useQuery({
    queryKey: ['admin', 'crypto-wallet'],
    queryFn: getAdminCryptoWalletInfo,
  })

  const pool = useQuery({
    queryKey: ['admin', 'crypto-wallet-pool'],
    queryFn: listCryptoHotWallets,
  })

  const combinedPoolKey = useMemo(() => stripKeyNoise(poolParts.join('')), [poolParts])

  const save = useMutation({
    mutationFn: () => {
      if (!looksLikeHexPrivateKey(combinedKey)) {
        throw new ApiError(
          `Private key must be 64 hex characters (currently ${combinedKey.length}). Paste into the 4 boxes — not a seed phrase.`,
          'invalid-argument',
        )
      }
      // Send base64 so wallet extensions that scan for raw hex keys do not strip the body.
      return setCryptoHotWallet({
        privateKeyB64: toBase64Utf8(`0x${combinedKey}`),
        rpcUrl: rpcUrl.trim() || undefined,
        autoWithdraw: true,
      })
    },
    onSuccess: async (res) => {
      toast.success(`Hot wallet saved: ${res.address}`)
      setParts(Array.from({ length: PART_COUNT }, () => ''))
      await queryClient.invalidateQueries({ queryKey: ['admin', 'crypto-wallet'] })
    },
    onError: (e: Error) => {
      const msg = e.message
        .replace(/^Firebase:\s*/i, '')
        .replace(/\s*\(functions\/[^)]+\)\.?$/i, '')
        .trim()
      toast.error(msg || 'Failed to save hot wallet')
    },
  })

  const addPoolWallet = useMutation({
    mutationFn: () => {
      if (!looksLikeHexPrivateKey(combinedPoolKey)) {
        throw new ApiError(
          `Private key must be 64 hex characters (currently ${combinedPoolKey.length}).`,
          'invalid-argument',
        )
      }
      return addCryptoHotWallet({
        privateKeyB64: toBase64Utf8(`0x${combinedPoolKey}`),
        label: poolLabel.trim() || undefined,
        rpcUrl: poolRpcUrl.trim() || undefined,
      })
    },
    onSuccess: async (res) => {
      toast.success(`Pool wallet added: ${res.address}`)
      setPoolParts(Array.from({ length: PART_COUNT }, () => ''))
      setPoolLabel('')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'crypto-wallet-pool'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const togglePoolWallet = useMutation({
    mutationFn: (input: {
      id: string
      enabled?: boolean
      useForDeposits?: boolean
      useForWithdrawals?: boolean
    }) => updateCryptoHotWallet(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin', 'crypto-wallet-pool'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const removePoolWallet = useMutation({
    mutationFn: (id: string) => removeCryptoHotWallet(id),
    onSuccess: async () => {
      toast.success('Wallet removed from pool')
      await queryClient.invalidateQueries({ queryKey: ['admin', 'crypto-wallet-pool'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  function updatePart(index: number, raw: string) {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, PART_LEN)
    setParts((prev) => {
      const next = [...prev]
      next[index] = cleaned
      return next
    })
  }

  function updatePoolPart(index: number, raw: string) {
    const cleaned = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, PART_LEN)
    setPoolParts((prev) => {
      const next = [...prev]
      next[index] = cleaned
      return next
    })
  }

  function onPastePoolPart(index: number, text: string) {
    const hex = stripKeyNoise(text)
    if (hex.length >= 64) {
      const full = hex.slice(0, 64)
      setPoolParts([
        full.slice(0, 16),
        full.slice(16, 32),
        full.slice(32, 48),
        full.slice(48, 64),
      ])
      return
    }
    const chunks: string[] = []
    for (let i = 0; i < hex.length; i += PART_LEN) {
      chunks.push(hex.slice(i, i + PART_LEN))
    }
    setPoolParts((prev) => {
      const next = [...prev]
      chunks.forEach((chunk, offset) => {
        if (index + offset < PART_COUNT) next[index + offset] = chunk
      })
      return next
    })
  }

  function onPastePart(index: number, text: string) {
    const hex = stripKeyNoise(text)
    if (hex.length >= 64) {
      const full = hex.slice(0, 64)
      setParts([
        full.slice(0, 16),
        full.slice(16, 32),
        full.slice(32, 48),
        full.slice(48, 64),
      ])
      return
    }
    // Distribute remaining paste across following boxes
    const chunks: string[] = []
    for (let i = 0; i < hex.length; i += PART_LEN) {
      chunks.push(hex.slice(i, i + PART_LEN))
    }
    setParts((prev) => {
      const next = [...prev]
      chunks.forEach((chunk, offset) => {
        if (index + offset < PART_COUNT) next[index + offset] = chunk
      })
      return next
    })
  }

  if (info.isLoading) return <LoadingState />
  if (info.isError) {
    return <ErrorState message={info.error.message} onRetry={() => info.refetch()} />
  }

  const data = info.data!

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl">Crypto hot wallet</h1>
        <p className="mt-1 text-ink-muted">
          One hot wallet can handle both deposits and withdrawals. Save a primary key below, or add
          a pool wallet with both roles checked. The private key is never returned after save.
        </p>
      </div>

      <Alert variant="warning">
        <ShieldAlert />
        <AlertTitle>MetaMask / wallet extensions</AlertTitle>
        <AlertDescription>
          Browser wallets often block or scramble private-key pastes on websites (that causes the
          400 error and <code>contentscript.js</code> warnings). Enter the key in 4 parts below, or
          temporarily disable MetaMask on this tab, then hard-refresh.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Status</CardDescription>
            <CardTitle className="font-sans text-xl">
              <Badge variant={data.configured ? 'success' : 'warning'}>
                {data.configured ? 'Configured' : 'Not set'}
              </Badge>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Deposit / withdraw address</CardDescription>
            <CardTitle className="break-all font-mono text-sm">{data.address ?? '—'}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Hot wallet USDT balance</CardDescription>
            <CardTitle className="font-sans text-2xl">
              {data.balanceUsdt != null ? `${data.balanceUsdt} USDT` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-sans text-lg">
            <KeyRound className="size-5" />
            Set / rotate private key
          </CardTitle>
          <CardDescription>
            Network: BSC, Token: USDT ({data.tokenAddress}). Export the hex key from MetaMask
            (Account details → Show private key), then paste once into the first box — it splits
            automatically. Do not use a seed phrase.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Private key (4 × 16 hex)</Label>
              <span className="text-xs text-ink-muted">{combinedKey.length}/64</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {parts.map((part, index) => (
                <Input
                  key={index}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  data-1p-ignore
                  data-lpignore="true"
                  data-form-type="other"
                  inputMode="text"
                  placeholder={`Part ${index + 1}`}
                  className="font-mono text-sm"
                  value={part}
                  onChange={(e) => updatePart(index, e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault()
                    onPastePart(index, e.clipboardData.getData('text'))
                  }}
                />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rpc">BSC RPC URL (optional)</Label>
            <Input
              id="rpc"
              placeholder="https://bsc-dataseed.binance.org"
              value={rpcUrl}
              onChange={(e) => setRpcUrl(e.target.value)}
            />
          </div>
          <Button
            onClick={() => save.mutate()}
            disabled={combinedKey.length !== 64 || save.isPending}
          >
            <Wallet className="size-4" />
            {save.isPending ? 'Saving…' : 'Save hot wallet'}
          </Button>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="font-sans text-lg">Hot wallet pool</CardTitle>
          <CardDescription>
            One wallet is enough: leave both Deposits and Withdrawals checked so the same address
            receives payments and sends payouts. Add more wallets only if you want to split roles.
            Turn on multi-wallet mode in Platform settings when using the pool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {pool.isLoading ? (
            <p className="text-sm text-ink-muted">Loading pool…</p>
          ) : pool.isError ? (
            <ErrorState message={pool.error.message} onRetry={() => pool.refetch()} />
          ) : (
            <>
              {(pool.data?.pool ?? []).length === 0 ? (
                <p className="text-sm text-ink-muted">
                  No pool wallets yet. Add one below — it defaults to deposits + withdrawals.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-canvas text-left text-xs text-ink-muted">
                        <th className="px-4 py-3">Label</th>
                        <th className="px-4 py-3">Address</th>
                        <th className="px-4 py-3">Role</th>
                        <th className="px-4 py-3">On</th>
                        <th className="px-4 py-3">Deposits</th>
                        <th className="px-4 py-3">Withdrawals</th>
                        <th className="px-4 py-3 w-32" />
                      </tr>
                    </thead>
                    <tbody>
                      {pool.data!.pool.map((w) => {
                        const forDeposits = w.useForDeposits !== false
                        const forWithdrawals = w.useForWithdrawals !== false
                        const roleLabel =
                          forDeposits && forWithdrawals
                            ? 'Both'
                            : forDeposits
                              ? 'Deposits'
                              : forWithdrawals
                                ? 'Withdrawals'
                                : 'None'
                        return (
                          <tr key={w.id} className="border-b border-line last:border-0">
                            <td className="px-4 py-3">{w.label || '—'}</td>
                            <td className="px-4 py-3 font-mono text-xs">{w.address}</td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  roleLabel === 'Both'
                                    ? 'success'
                                    : roleLabel === 'None'
                                      ? 'secondary'
                                      : 'warning'
                                }
                              >
                                {roleLabel}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={w.enabled ? 'success' : 'secondary'}>
                                {w.enabled ? 'Yes' : 'No'}
                              </Badge>
                            </td>
                            <td className="px-4 py-3">
                              <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-line"
                                  checked={forDeposits}
                                  disabled={togglePoolWallet.isPending || !w.enabled}
                                  onChange={() =>
                                    togglePoolWallet.mutate({
                                      id: w.id,
                                      useForDeposits: !forDeposits,
                                    })
                                  }
                                />
                                Receive
                              </label>
                            </td>
                            <td className="px-4 py-3">
                              <label className="inline-flex items-center gap-2 text-xs text-ink-muted">
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-line"
                                  checked={forWithdrawals}
                                  disabled={togglePoolWallet.isPending || !w.enabled}
                                  onChange={() =>
                                    togglePoolWallet.mutate({
                                      id: w.id,
                                      useForWithdrawals: !forWithdrawals,
                                    })
                                  }
                                />
                                Send
                              </label>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    togglePoolWallet.mutate({ id: w.id, enabled: !w.enabled })
                                  }
                                  disabled={togglePoolWallet.isPending}
                                >
                                  {w.enabled ? 'Disable' : 'Enable'}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-danger"
                                  title="Remove wallet"
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        'Remove this wallet from the pool? Deposits/withdrawals will stop using it.',
                                      )
                                    ) {
                                      removePoolWallet.mutate(w.id)
                                    }
                                  }}
                                  disabled={removePoolWallet.isPending}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="space-y-4 rounded-xl border border-line bg-canvas p-4">
                <p className="text-sm font-semibold">Add pool wallet</p>
                <p className="text-xs text-ink-muted">
                  New wallets start as <strong>Both</strong> (deposits + withdrawals). Uncheck one
                  side later only if you add a second wallet to split roles.
                </p>
                <div className="space-y-2">
                  <Label>Label (optional)</Label>
                  <Input value={poolLabel} onChange={(e) => setPoolLabel(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Private key (4 × 16 hex)</Label>
                    <span className="text-xs text-ink-muted">{combinedPoolKey.length}/64</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {poolParts.map((part, index) => (
                      <Input
                        key={index}
                        autoComplete="off"
                        className="font-mono text-sm"
                        placeholder={`Part ${index + 1}`}
                        value={part}
                        onChange={(e) => updatePoolPart(index, e.target.value)}
                        onPaste={(e) => {
                          e.preventDefault()
                          onPastePoolPart(index, e.clipboardData.getData('text'))
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>BSC RPC URL (optional)</Label>
                  <Input value={poolRpcUrl} onChange={(e) => setPoolRpcUrl(e.target.value)} />
                </div>
                <Button
                  onClick={() => addPoolWallet.mutate()}
                  disabled={combinedPoolKey.length !== 64 || addPoolWallet.isPending}
                >
                  Add to pool
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
