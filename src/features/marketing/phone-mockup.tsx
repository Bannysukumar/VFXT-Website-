import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BatteryCharging,
  ChevronRight,
  Fingerprint,
  Home,
  LayoutGrid,
  Pickaxe,
  QrCode,
  Shield,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { LogoTile } from '@/components/shared/logo'
import { cn } from '@/lib/utils'

const ease = [0.22, 1, 0.36, 1] as const

export type WalletScreen = 'home' | 'mining' | 'send' | 'assets' | 'receive' | 'security'

/** Realistic phone chrome wrapping a wallet UI screen. */
export function PhoneFrame({
  children,
  className,
  float = false,
  dark = true,
}: {
  children: ReactNode
  className?: string
  float?: boolean
  dark?: boolean
}) {
  return (
    <div
      className={cn(
        'relative mx-auto w-[240px] shrink-0 sm:w-[260px]',
        float && 'animate-float-slow',
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-[2.15rem] border-[7px] shadow-2xl',
          dark
            ? 'border-[#0c1210] bg-[#070b09] shadow-black/50'
            : 'border-[#1a1f1c] bg-white shadow-brand/20',
        )}
      >
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-2.5 z-20 h-5 w-[72px] -translate-x-1/2 rounded-full bg-black" />
        {/* Side buttons hint */}
        <div className="pointer-events-none absolute -left-[9px] top-24 h-10 w-[3px] rounded-l bg-[#1a221e]" />
        <div className="pointer-events-none absolute -left-[9px] top-40 h-14 w-[3px] rounded-l bg-[#1a221e]" />
        <div className="pointer-events-none absolute -right-[9px] top-32 h-16 w-[3px] rounded-r bg-[#1a221e]" />
        <div className="aspect-[9/19.2] overflow-hidden">{children}</div>
      </div>
    </div>
  )
}

function StatusBar({ light = false }: { light?: boolean }) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-5 pb-1 pt-3.5 text-[9px] font-semibold',
        light ? 'text-ink/70' : 'text-white/70',
      )}
    >
      <span>9:41</span>
      <span className="flex gap-1">
        <span className="inline-block h-1.5 w-3 rounded-sm bg-current opacity-80" />
        <span className="inline-block h-1.5 w-2 rounded-sm bg-current opacity-60" />
      </span>
    </div>
  )
}

function TabBar({ active }: { active: 'home' | 'mining' | 'trade' | 'assets' | 'profile' }) {
  const items = [
    { id: 'home' as const, icon: Home, label: 'Home' },
    { id: 'mining' as const, icon: Pickaxe, label: 'Mining' },
    { id: 'trade' as const, icon: TrendingUp, label: 'Trade' },
    { id: 'assets' as const, icon: LayoutGrid, label: 'Assets' },
    { id: 'profile' as const, icon: Wallet, label: 'Profile' },
  ]
  return (
    <div className="mt-auto grid grid-cols-5 border-t border-white/8 bg-[#0a100e]/95 px-1 pb-3 pt-2">
      {items.map(({ id, icon: Icon, label }) => (
        <div
          key={id}
          className={cn(
            'flex flex-col items-center gap-0.5 text-[8px]',
            active === id ? 'text-accent-bright' : 'text-white/35',
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </div>
      ))}
    </div>
  )
}

function HomeScreen() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0d1714] via-[#0a120f] to-[#070b09] text-white">
      <StatusBar />
      <div className="flex items-center justify-between px-4 pt-2">
        <div className="flex items-center gap-2">
          <LogoTile className="size-7 rounded-lg" />
          <div>
            <p className="text-[9px] text-white/45">Main wallet</p>
            <p className="text-[11px] font-semibold">0x7a…3f91</p>
          </div>
        </div>
        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[9px] text-accent-bright">BSC</span>
      </div>
      <div className="px-4 pt-5">
        <div className="mb-1.5 flex items-center gap-2">
          <p className="text-[10px] text-white/45">Total balance</p>
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-white/55">
            Demo
          </span>
        </div>
        <p className="font-display text-[28px] font-bold tracking-tight">$12,480.50</p>
        <p className="mt-1 text-[10px] text-accent-bright">+2.4% today</p>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 px-4">
        {[
          { icon: ArrowUpRight, label: 'Send' },
          { icon: ArrowDownLeft, label: 'Receive' },
          { icon: TrendingUp, label: 'Swap' },
          { icon: QrCode, label: 'Scan' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <span className="grid size-9 place-items-center rounded-2xl bg-accent/90 text-white">
              <Icon className="size-3.5" />
            </span>
            <span className="text-[9px] text-white/60">{label}</span>
          </div>
        ))}
      </div>
      <div className="mt-5 space-y-2 px-4">
        <p className="text-[10px] font-semibold text-white/50">Assets</p>
        {[
          { sym: 'BNB', name: 'BNB', amt: '2.14', usd: '$1,280' },
          { sym: 'USDT', name: 'Tether', amt: '4,200', usd: '$4,200' },
          { sym: 'VFXT', name: 'VFXT', amt: '18,500', usd: '$6,120' },
        ].map((row) => (
          <div
            key={row.sym}
            className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.04] px-3 py-2.5"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-accent/20 text-[9px] font-bold text-accent-bright">
                {row.sym.slice(0, 2)}
              </span>
              <div>
                <p className="text-[11px] font-semibold">{row.name}</p>
                <p className="text-[9px] text-white/40">
                  {row.amt} {row.sym}
                </p>
              </div>
            </div>
            <p className="text-[11px] font-semibold">{row.usd}</p>
          </div>
        ))}
      </div>
      <TabBar active="home" />
    </div>
  )
}

function MiningScreen() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0d1714] via-[#0a120f] to-[#070b09] text-white">
      <StatusBar />
      <div className="px-4 pt-3">
        <p className="text-[10px] text-white/45">Mining session</p>
        <p className="font-display text-xl font-bold">Daily mine</p>
      </div>
      <div className="relative mx-auto mt-6 grid size-36 place-items-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 size-full -rotate-90">
          <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <circle
            cx="60"
            cy="60"
            r="52"
            fill="none"
            stroke="var(--color-accent-bright)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${52 * 2 * Math.PI * 0.68} ${52 * 2 * Math.PI}`}
          />
        </svg>
        <div className="text-center">
          <p className="font-display text-2xl font-bold">68%</p>
          <p className="text-[9px] text-white/45">04:12:38 left</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 px-4">
        {[
          { label: 'Available', value: '124.5 VFXT' },
          { label: 'Lifetime', value: '2,840 VFXT' },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/6 bg-white/[0.04] p-3">
            <p className="text-[9px] text-white/45">{s.label}</p>
            <p className="mt-1 text-[12px] font-semibold">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mx-4 mt-3 flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-3 py-2.5">
        <BatteryCharging className="size-4 text-accent-bright" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold">Speed booster active</p>
          <p className="text-[9px] text-white/45">+25% until session ends</p>
        </div>
      </div>
      <button
        type="button"
        className="mx-4 mt-4 rounded-2xl bg-accent py-2.5 text-center text-[11px] font-semibold text-white"
      >
        Claim VFXT
      </button>
      <TabBar active="mining" />
    </div>
  )
}

function SendScreen() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0d1714] to-[#070b09] text-white">
      <StatusBar />
      <div className="px-4 pt-3">
        <p className="text-[10px] text-white/45">Send</p>
        <p className="font-display text-xl font-bold">USDT</p>
      </div>
      <div className="mx-4 mt-5 rounded-3xl border border-white/8 bg-white/[0.04] p-4">
        <p className="text-[9px] text-white/40">Amount</p>
        <p className="mt-1 font-display text-3xl font-bold">250.00</p>
        <p className="mt-1 text-[10px] text-white/40">≈ $250.00</p>
      </div>
      <div className="mx-4 mt-3 rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-3">
        <p className="text-[9px] text-white/40">To</p>
        <p className="mt-1 truncate text-[11px] font-medium">0x4f2a…c81e</p>
      </div>
      <div className="mx-4 mt-3 space-y-2 rounded-2xl border border-white/8 bg-white/[0.04] p-3 text-[10px]">
        <div className="flex justify-between text-white/55">
          <span>Network</span>
          <span className="text-white">BNB Smart Chain</span>
        </div>
        <div className="flex justify-between text-white/55">
          <span>Network fee</span>
          <span className="text-white">~0.0003 BNB</span>
        </div>
      </div>
      <div className="mx-4 mt-auto mb-4 flex items-center gap-2 rounded-2xl bg-accent/15 px-3 py-2.5">
        <Fingerprint className="size-4 text-accent-bright" />
        <p className="text-[10px] text-white/80">Confirm with biometrics</p>
      </div>
    </div>
  )
}

function AssetsScreen() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0d1714] to-[#070b09] text-white">
      <StatusBar />
      <div className="px-4 pt-3">
        <p className="font-display text-xl font-bold">Assets</p>
        <p className="mt-1 text-[10px] text-white/45">7 tokens · BSC</p>
      </div>
      <div className="mx-4 mt-3 rounded-2xl border border-white/8 bg-white/[0.05] px-3 py-2 text-[10px] text-white/40">
        Search tokens
      </div>
      <div className="mt-3 space-y-1.5 px-3">
        {[
          ['BNB', 'BNB', '$1,280.00'],
          ['USDT', 'Tether USD', '$4,200.00'],
          ['VFXT', 'Virtual FX Trades', '$6,120.00'],
          ['USDC', 'USD Coin', '$880.50'],
        ].map(([sym, name, usd]) => (
          <div key={sym} className="flex items-center justify-between rounded-2xl px-2 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-white/8 text-[9px] font-bold text-accent-bright">
                {sym.slice(0, 2)}
              </span>
              <div>
                <p className="text-[11px] font-semibold">{sym}</p>
                <p className="text-[9px] text-white/40">{name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold">{usd}</p>
              <ChevronRight className="ml-auto size-3 text-white/25" />
            </div>
          </div>
        ))}
      </div>
      <TabBar active="assets" />
    </div>
  )
}

function ReceiveScreen() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0d1714] to-[#070b09] text-white">
      <StatusBar />
      <div className="px-4 pt-3 text-center">
        <p className="text-[10px] text-white/45">Receive on</p>
        <p className="font-display text-lg font-bold">BNB Smart Chain</p>
      </div>
      <div className="mx-auto mt-6 grid size-40 place-items-center rounded-3xl bg-white p-3 shadow-lift">
        <div
          className="size-full rounded-xl"
          style={{
            backgroundImage:
              'linear-gradient(#0a1915 1px, transparent 1px), linear-gradient(90deg, #0a1915 1px, transparent 1px)',
            backgroundSize: '10px 10px',
            backgroundColor: '#fff',
          }}
        />
      </div>
      <p className="mx-6 mt-4 break-all text-center text-[10px] leading-relaxed text-white/55">
        0x7a91c2e8f04b…3f91
      </p>
      <div className="mx-4 mt-5 grid grid-cols-2 gap-2">
        <span className="rounded-2xl bg-white/8 py-2.5 text-center text-[11px] font-semibold">Copy</span>
        <span className="rounded-2xl bg-accent py-2.5 text-center text-[11px] font-semibold">Share</span>
      </div>
      <p className="mx-6 mt-auto mb-6 text-center text-[9px] text-white/35">
        Only send BEP-20 assets on this network
      </p>
    </div>
  )
}

function SecurityScreen() {
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-[#0d1714] to-[#070b09] text-white">
      <StatusBar />
      <div className="px-4 pt-3">
        <p className="font-display text-xl font-bold">Security</p>
      </div>
      <div className="mx-4 mt-5 flex flex-col items-center rounded-3xl border border-white/8 bg-white/[0.04] p-5">
        <span className="grid size-14 place-items-center rounded-full bg-accent/20 text-accent-bright">
          <Shield className="size-7" />
        </span>
        <p className="mt-3 text-[12px] font-semibold">App lock on</p>
        <p className="mt-1 text-center text-[9px] text-white/45">PIN + biometrics · auto-lock 5 min</p>
      </div>
      <div className="mt-4 space-y-2 px-4">
        {['Change PIN', 'Biometrics', 'Auto-lock', 'Show recovery phrase'].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3"
          >
            <span className="text-[11px]">{row}</span>
            <ChevronRight className="size-3.5 text-white/30" />
          </div>
        ))}
      </div>
    </div>
  )
}

const screens: Record<WalletScreen, () => ReactNode> = {
  home: HomeScreen,
  mining: MiningScreen,
  send: SendScreen,
  assets: AssetsScreen,
  receive: ReceiveScreen,
  security: SecurityScreen,
}

export function WalletPhone({
  screen = 'home',
  className,
  float,
}: {
  screen?: WalletScreen
  className?: string
  float?: boolean
}) {
  const Screen = screens[screen]
  return (
    <PhoneFrame className={className} float={float}>
      <Screen />
    </PhoneFrame>
  )
}

/** Two overlapping phones — classic product hero. */
export function PhonePair({
  front = 'home',
  back = 'mining',
  className,
}: {
  front?: WalletScreen
  back?: WalletScreen
  className?: string
}) {
  return (
    <div
      className={cn(
        'relative mx-auto flex h-[440px] w-full max-w-md items-end justify-center sm:h-[520px]',
        className,
      )}
    >
      <motion.div
        initial={{ opacity: 0, x: 40, rotate: 8 }}
        animate={{ opacity: 1, x: 0, rotate: 8 }}
        transition={{ duration: 0.9, ease }}
        className="absolute right-[4%] top-4 origin-bottom scale-[0.78] opacity-90 sm:right-[8%] sm:top-8 sm:scale-[0.88]"
      >
        <WalletPhone screen={back} />
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.85, delay: 0.1, ease }}
        className="relative z-10 scale-[0.92] sm:scale-100"
      >
        <WalletPhone screen={front} float />
      </motion.div>
    </div>
  )
}

/** Three-phone product strip for mid-page sections. */
export function PhoneTrio({
  screens: list = ['home', 'mining', 'send'],
  className,
}: {
  screens?: WalletScreen[]
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-end justify-center gap-3 overflow-x-auto pb-2 sm:gap-6 sm:overflow-visible',
        className,
      )}
    >
      {list.map((screen, i) => (
        <motion.div
          key={screen}
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: i * 0.1, ease }}
          className={cn(i === 1 ? 'scale-100' : 'scale-[0.88] opacity-90', 'shrink-0')}
        >
          <WalletPhone screen={screen} float={i === 1} />
        </motion.div>
      ))}
    </div>
  )
}

/** Full-width band with phones + short caption. */
export function PhoneShowcaseBand({
  title,
  description,
  screens: list = ['home', 'assets', 'receive'],
}: {
  title: string
  description: string
  screens?: WalletScreen[]
}) {
  return (
    <section className="overflow-hidden border-y border-line bg-panel">
      <div className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h2>
          <p className="mt-4 text-base text-ink-muted">{description}</p>
        </div>
        <div className="mt-14">
          <PhoneTrio screens={list} />
        </div>
      </div>
    </section>
  )
}
