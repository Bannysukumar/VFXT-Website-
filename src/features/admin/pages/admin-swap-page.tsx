import { useCallback, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Contract,
  formatUnits,
  parseUnits,
  type BrowserProvider,
  type ContractTransactionResponse,
  type JsonRpcSigner,
} from 'ethers'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  RefreshCw,
  Tags,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { LoadingState } from '@/components/shared/loading-state'
import { PageHeader } from '@/components/shared/page-header'
import { env } from '@/lib/env'
import {
  connectEvmWallet,
  normalizeAddress,
  shortenError,
  txUrl,
} from '@/lib/evm-wallet'
import { shortAddress } from '@/lib/vfxt-token'
import { ERC20_ABI, VFXT_SWAP, VFXT_SWAP_ABI, resolveSwapAddress } from '@/lib/vfxt-swap'
import { cn } from '@/lib/utils'

type TokenChoice = 'vfxt' | 'usdt' | 'custom'

type SwapState = {
  owner: string
  priceManager: string
  buyPrice: bigint
  sellPrice: bigint
  paused: boolean
  vfxtReserve: bigint
  usdtReserve: bigint
  vfxtWallet: bigint
  usdtWallet: bigint
  vfxtAllowance: bigint
  usdtAllowance: bigint
  minUsdt: bigint
  maxUsdt: bigint
}

function priceToInput(value: bigint): string {
  const formatted = formatUnits(value, 18)
  // Trim trailing zeros for cleaner editing.
  return formatted.replace(/(\.\d*?[1-9])0+$/, '$1').replace(/\.0+$/, '').replace(/\.$/, '') || '0'
}

function parsePriceInput(value: string): bigint {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Enter a price')
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Price must be a positive number')
  return parseUnits(trimmed, 18)
}

function parseAmountInput(value: string, decimals = 18): bigint {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Enter an amount')
  if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error('Amount must be a positive number')
  return parseUnits(trimmed, decimals)
}

export function AdminSwapPage() {
  const queryClient = useQueryClient()
  const swapAddress = resolveSwapAddress(env.VITE_VFXT_SWAP_ADDRESS)

  const [wallet, setWallet] = useState<string | null>(null)
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null)

  const [buyInput, setBuyInput] = useState('0.0001')
  const [sellInput, setSellInput] = useState('0.0001')

  const [depositToken, setDepositToken] = useState<TokenChoice>('vfxt')
  const [depositAmount, setDepositAmount] = useState('')

  const [withdrawToken, setWithdrawToken] = useState<TokenChoice>('vfxt')
  const [withdrawCustom, setWithdrawCustom] = useState('')
  const [withdrawTo, setWithdrawTo] = useState('')
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAll, setWithdrawAll] = useState(false)

  const connect = useMutation({
    mutationFn: connectEvmWallet,
    onSuccess: ({ address, provider: p, signer: s }) => {
      setWallet(address)
      setProvider(p)
      setSigner(s)
      setWithdrawTo((prev) => prev || address)
      toast.success(`Connected ${shortAddress(address, 6)}`)
    },
    onError: (e: unknown) => toast.error(shortenError(e)),
  })

  const disconnect = useCallback(() => {
    setWallet(null)
    setProvider(null)
    setSigner(null)
  }, [])

  const stateQuery = useQuery({
    queryKey: ['admin', 'vfxt-swap', swapAddress, wallet],
    enabled: Boolean(provider),
    refetchInterval: 15_000,
    queryFn: async (): Promise<SwapState> => {
      if (!provider || !wallet) throw new Error('Connect wallet first')
      const swap = new Contract(swapAddress, VFXT_SWAP_ABI, provider)
      const vfxt = new Contract(VFXT_SWAP.vfxt, ERC20_ABI, provider)
      const usdt = new Contract(VFXT_SWAP.usdt, ERC20_ABI, provider)
      const [
        owner,
        priceManager,
        buyPrice,
        sellPrice,
        paused,
        reserves,
        vfxtWallet,
        usdtWallet,
        vfxtAllowance,
        usdtAllowance,
        minUsdt,
        maxUsdt,
      ] = await Promise.all([
        swap.owner() as Promise<string>,
        swap.priceManager() as Promise<string>,
        swap.buyPrice() as Promise<bigint>,
        swap.sellPrice() as Promise<bigint>,
        swap.paused() as Promise<boolean>,
        swap.reserves() as Promise<[bigint, bigint]>,
        vfxt.balanceOf(wallet) as Promise<bigint>,
        usdt.balanceOf(wallet) as Promise<bigint>,
        vfxt.allowance(wallet, swapAddress) as Promise<bigint>,
        usdt.allowance(wallet, swapAddress) as Promise<bigint>,
        swap.minUsdtPerTrade() as Promise<bigint>,
        swap.maxUsdtPerTrade() as Promise<bigint>,
      ])
      return {
        owner,
        priceManager,
        buyPrice,
        sellPrice,
        paused,
        vfxtReserve: reserves[0],
        usdtReserve: reserves[1],
        vfxtWallet,
        usdtWallet,
        vfxtAllowance,
        usdtAllowance,
        minUsdt,
        maxUsdt,
      }
    },
  })

  useEffect(() => {
    if (!stateQuery.data) return
    setBuyInput(priceToInput(stateQuery.data.buyPrice))
    setSellInput(priceToInput(stateQuery.data.sellPrice))
  }, [stateQuery.data?.buyPrice, stateQuery.data?.sellPrice])

  const isOwner = useMemo(() => {
    if (!wallet || !stateQuery.data) return false
    return wallet.toLowerCase() === stateQuery.data.owner.toLowerCase()
  }, [wallet, stateQuery.data])

  const isPriceAdmin = useMemo(() => {
    if (!wallet || !stateQuery.data) return false
    const mgr = stateQuery.data.priceManager
    return (
      isOwner ||
      (Boolean(mgr) && mgr.toLowerCase() !== '0x0000000000000000000000000000000000000000' &&
        wallet.toLowerCase() === mgr.toLowerCase())
    )
  }, [wallet, stateQuery.data, isOwner])

  const tokenAddress = useCallback(
    (choice: TokenChoice, custom?: string) => {
      if (choice === 'vfxt') return VFXT_SWAP.vfxt
      if (choice === 'usdt') return VFXT_SWAP.usdt
      return normalizeAddress(custom || '')
    },
    [],
  )

  const runTx = useCallback(
    async (label: string, action: (s: JsonRpcSigner) => Promise<ContractTransactionResponse>) => {
      if (!signer) throw new Error('Connect the admin wallet first')
      const tx = await action(signer)
      toast.message(`${label}: waiting for confirmation…`)
      await tx.wait()
      toast.success(
        <span className="inline-flex items-center gap-2">
          {label} confirmed
          <a href={txUrl(tx.hash)} target="_blank" rel="noreferrer" className="underline">
            view tx
          </a>
        </span>,
      )
      await queryClient.invalidateQueries({ queryKey: ['admin', 'vfxt-swap'] })
      return tx.hash
    },
    [signer, queryClient],
  )

  const setPrices = useMutation({
    mutationFn: async () => {
      const buy = parsePriceInput(buyInput)
      const sell = parsePriceInput(sellInput)
      if (buy !== 0n && sell > buy) throw new Error('Sell price cannot exceed buy price')
      return runTx('Prices updated', async (s) => {
        const swap = new Contract(swapAddress, VFXT_SWAP_ABI, s)
        return swap.setPrices(buy, sell)
      })
    },
    onError: (e: unknown) => toast.error(shortenError(e)),
  })

  const togglePause = useMutation({
    mutationFn: async () => {
      const paused = stateQuery.data?.paused
      return runTx(paused ? 'Unpaused' : 'Paused', async (s) => {
        const swap = new Contract(swapAddress, VFXT_SWAP_ABI, s)
        return paused ? swap.unpause() : swap.pause()
      })
    },
    onError: (e: unknown) => toast.error(shortenError(e)),
  })

  const approveDeposit = useMutation({
    mutationFn: async () => {
      const token = tokenAddress(depositToken)
      const amount = parseAmountInput(depositAmount)
      return runTx('Approval', async (s) => {
        const erc20 = new Contract(token, ERC20_ABI, s)
        return erc20.approve(swapAddress, amount)
      })
    },
    onError: (e: unknown) => toast.error(shortenError(e)),
  })

  const deposit = useMutation({
    mutationFn: async () => {
      const token = tokenAddress(depositToken)
      const amount = parseAmountInput(depositAmount)
      return runTx('Deposit', async (s) => {
        const swap = new Contract(swapAddress, VFXT_SWAP_ABI, s)
        return swap.deposit(token, amount)
      })
    },
    onSuccess: () => setDepositAmount(''),
    onError: (e: unknown) => toast.error(shortenError(e)),
  })

  const withdraw = useMutation({
    mutationFn: async () => {
      const token = tokenAddress(withdrawToken, withdrawCustom)
      const to = normalizeAddress(withdrawTo || wallet || '')
      return runTx(withdrawAll ? 'Withdraw all' : 'Withdraw', async (s) => {
        const swap = new Contract(swapAddress, VFXT_SWAP_ABI, s)
        if (withdrawAll) return swap.withdrawAll(token, to)
        const amount = parseAmountInput(withdrawAmount)
        return swap.withdraw(token, to, amount)
      })
    },
    onSuccess: () => {
      setWithdrawAmount('')
      setWithdrawAll(false)
    },
    onError: (e: unknown) => toast.error(shortenError(e)),
  })

  const busy =
    setPrices.isPending ||
    togglePause.isPending ||
    approveDeposit.isPending ||
    deposit.isPending ||
    withdraw.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="On-chain desk"
        title="VFXT Swap admin"
        description="Connect the contract owner wallet to set prices, deposit / withdraw liquidity, and pause trading. Transactions are signed in your wallet — nothing is sent to VFXT servers."
      />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-accent" />
              Admin wallet
            </CardTitle>
            <CardDescription>
              Must be the VFXTSwap owner (
              {stateQuery.data ? shortAddress(stateQuery.data.owner, 6) : '…'}) on BNB Smart Chain.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {wallet ? (
              <>
                <Badge variant="success" className="font-mono">
                  {shortAddress(wallet, 6)}
                </Badge>
                <Button variant="outline" size="sm" onClick={disconnect}>
                  Disconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void stateQuery.refetch()}
                  disabled={stateQuery.isFetching}
                >
                  <RefreshCw className={cn('size-4', stateQuery.isFetching && 'animate-spin')} />
                  Refresh
                </Button>
              </>
            ) : (
              <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
                {connect.isPending ? 'Connecting…' : 'Connect wallet'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Meta label="Swap contract" value={shortAddress(swapAddress, 6)} href={VFXT_SWAP.explorerUrl} />
          <Meta label="VFXT token" value={shortAddress(VFXT_SWAP.vfxt, 6)} href={`https://bscscan.com/token/${VFXT_SWAP.vfxt}`} />
          <Meta label="USDT" value={shortAddress(VFXT_SWAP.usdt, 6)} href={`https://bscscan.com/token/${VFXT_SWAP.usdt}`} />
          <Meta
            label="Status"
            value={
              !wallet
                ? 'Wallet not connected'
                : stateQuery.isLoading
                  ? 'Loading…'
                  : isOwner
                    ? 'Owner connected'
                    : isPriceAdmin
                      ? 'Price manager connected'
                      : 'Not the owner'
            }
          />
        </CardContent>
      </Card>

      {wallet && stateQuery.isError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load swap state</AlertTitle>
          <AlertDescription>{shortenError(stateQuery.error)}</AlertDescription>
        </Alert>
      ) : null}

      {wallet && stateQuery.data && !isOwner && !isPriceAdmin ? (
        <Alert>
          <AlertTitle>Wrong wallet</AlertTitle>
          <AlertDescription>
            Connected {shortAddress(wallet, 6)}. Owner is {shortAddress(stateQuery.data.owner, 6)}.
            Switch accounts in MetaMask to the owner wallet to deposit, withdraw, or pause.
          </AlertDescription>
        </Alert>
      ) : null}

      {!wallet ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-ink-muted">
            Connect the admin wallet to manage VFXTSwap.
          </CardContent>
        </Card>
      ) : stateQuery.isLoading || !stateQuery.data ? (
        <LoadingState label="Loading swap contract…" />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Tags className="size-5 text-accent" />
                  Token price
                </CardTitle>
                <CardDescription>
                  USDT paid or received per 1 VFXT. Use 0 to disable that side. Sell cannot exceed buy.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="buy-price">Buy price (USDT / VFXT)</Label>
                    <Input
                      id="buy-price"
                      inputMode="decimal"
                      value={buyInput}
                      onChange={(e) => setBuyInput(e.target.value)}
                      placeholder="0.0001"
                      disabled={!isPriceAdmin || busy}
                    />
                    <p className="text-xs text-ink-muted">
                      On-chain: {priceToInput(stateQuery.data.buyPrice)}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sell-price">Sell price (USDT / VFXT)</Label>
                    <Input
                      id="sell-price"
                      inputMode="decimal"
                      value={sellInput}
                      onChange={(e) => setSellInput(e.target.value)}
                      placeholder="0.0001"
                      disabled={!isPriceAdmin || busy}
                    />
                    <p className="text-xs text-ink-muted">
                      On-chain: {priceToInput(stateQuery.data.sellPrice)}
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => setPrices.mutate()}
                  disabled={!isPriceAdmin || busy}
                >
                  {setPrices.isPending ? 'Updating…' : 'Update prices'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {stateQuery.data.paused ? (
                    <PauseCircle className="size-5 text-highlight" />
                  ) : (
                    <PlayCircle className="size-5 text-accent" />
                  )}
                  Trading status
                </CardTitle>
                <CardDescription>
                  Pause stops buy/sell. Deposits and withdrawals still work while paused.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-line bg-panel-elevated px-4 py-3">
                  <div>
                    <p className="font-medium">{stateQuery.data.paused ? 'Paused' : 'Live'}</p>
                    <p className="text-xs text-ink-muted">
                      Reserves · {formatUnits(stateQuery.data.vfxtReserve, 18)} VFXT ·{' '}
                      {formatUnits(stateQuery.data.usdtReserve, 18)} USDT
                    </p>
                  </div>
                  <Badge variant={stateQuery.data.paused ? 'warning' : 'success'}>
                    {stateQuery.data.paused ? 'Paused' : 'Active'}
                  </Badge>
                </div>
                <Button
                  variant={stateQuery.data.paused ? 'accent' : 'outline'}
                  onClick={() => togglePause.mutate()}
                  disabled={!isOwner || busy}
                >
                  {togglePause.isPending
                    ? 'Sending…'
                    : stateQuery.data.paused
                      ? 'Unpause trading'
                      : 'Pause trading'}
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownToLine className="size-5 text-accent" />
                  Deposit liquidity
                </CardTitle>
                <CardDescription>
                  Approve the amount from this wallet, then deposit VFXT or USDT into the swap desk.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Token</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['vfxt', 'usdt'] as const).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={depositToken === t ? 'default' : 'outline'}
                        onClick={() => setDepositToken(t)}
                        disabled={!isOwner || busy}
                      >
                        {t.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-ink-muted">
                    Wallet balance:{' '}
                    {depositToken === 'vfxt'
                      ? `${formatUnits(stateQuery.data.vfxtWallet, 18)} VFXT`
                      : `${formatUnits(stateQuery.data.usdtWallet, 18)} USDT`}
                    {' · '}
                    Allowance:{' '}
                    {depositToken === 'vfxt'
                      ? formatUnits(stateQuery.data.vfxtAllowance, 18)
                      : formatUnits(stateQuery.data.usdtAllowance, 18)}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Amount</Label>
                  <Input
                    id="deposit-amount"
                    inputMode="decimal"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.0"
                    disabled={!isOwner || busy}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => approveDeposit.mutate()}
                    disabled={!isOwner || busy || !depositAmount.trim()}
                  >
                    {approveDeposit.isPending ? 'Approving…' : '1. Approve'}
                  </Button>
                  <Button
                    onClick={() => deposit.mutate()}
                    disabled={!isOwner || busy || !depositAmount.trim()}
                  >
                    {deposit.isPending ? 'Depositing…' : '2. Deposit'}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpFromLine className="size-5 text-accent" />
                  Withdraw
                </CardTitle>
                <CardDescription>
                  Send VFXT, USDT, or any stuck ERC-20 to your wallet or any other address.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Token</Label>
                  <div className="flex flex-wrap gap-2">
                    {(['vfxt', 'usdt', 'custom'] as const).map((t) => (
                      <Button
                        key={t}
                        type="button"
                        size="sm"
                        variant={withdrawToken === t ? 'default' : 'outline'}
                        onClick={() => setWithdrawToken(t)}
                        disabled={!isOwner || busy}
                      >
                        {t === 'custom' ? 'Custom' : t.toUpperCase()}
                      </Button>
                    ))}
                  </div>
                </div>
                {withdrawToken === 'custom' ? (
                  <div className="space-y-2">
                    <Label htmlFor="withdraw-custom">Token contract</Label>
                    <Input
                      id="withdraw-custom"
                      value={withdrawCustom}
                      onChange={(e) => setWithdrawCustom(e.target.value)}
                      placeholder="0x…"
                      disabled={!isOwner || busy}
                      className="font-mono text-sm"
                    />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor="withdraw-to">Destination</Label>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      id="withdraw-to"
                      value={withdrawTo}
                      onChange={(e) => setWithdrawTo(e.target.value)}
                      placeholder="0x… or leave blank for this wallet"
                      disabled={!isOwner || busy}
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!isOwner || busy || !wallet}
                      onClick={() => setWithdrawTo(wallet || '')}
                    >
                      My wallet
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="withdraw-amount">Amount</Label>
                    <label className="flex items-center gap-2 text-xs text-ink-muted">
                      <input
                        type="checkbox"
                        checked={withdrawAll}
                        onChange={(e) => setWithdrawAll(e.target.checked)}
                        disabled={!isOwner || busy}
                      />
                      Withdraw all
                    </label>
                  </div>
                  <Input
                    id="withdraw-amount"
                    inputMode="decimal"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.0"
                    disabled={!isOwner || busy || withdrawAll}
                  />
                  <p className="text-xs text-ink-muted">
                    Contract holds {formatUnits(stateQuery.data.vfxtReserve, 18)} VFXT ·{' '}
                    {formatUnits(stateQuery.data.usdtReserve, 18)} USDT
                  </p>
                </div>
                <Button
                  onClick={() => withdraw.mutate()}
                  disabled={
                    !isOwner ||
                    busy ||
                    (!withdrawAll && !withdrawAmount.trim()) ||
                    (withdrawToken === 'custom' && !withdrawCustom.trim())
                  }
                >
                  {withdraw.isPending ? 'Withdrawing…' : withdrawAll ? 'Withdraw all' : 'Withdraw'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function Meta({
  label,
  value,
  href,
}: {
  label: string
  value: string
  href?: string
}) {
  return (
    <div className="rounded-xl border border-line bg-panel-elevated px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-flex items-center gap-1 font-mono text-sm font-semibold hover:text-accent"
        >
          {value}
          <ExternalLink className="size-3.5" />
        </a>
      ) : (
        <p className="mt-1 text-sm font-semibold">{value}</p>
      )}
    </div>
  )
}
