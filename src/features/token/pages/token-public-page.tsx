import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  CheckCircle2,
  Circle,
  Coins,
  Copy,
  Gamepad2,
  Hash,
  Link2,
  Network,
  PiggyBank,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { LogoMark } from '@/components/shared/logo'
import { ParallaxImage, Reveal } from '@/components/motion/reveal'
import { CtaBand, MarketingHero, SectionHeading, StatsBand } from '@/features/marketing/marketing-hero'
import { CountUp } from '@/components/motion/reveal'
import { env } from '@/lib/env'
import { images, videos } from '@/lib/media'

const roadmap = [
  { label: 'ERC-20 contract written and unit tested', done: true },
  { label: 'Off-chain ledger and settlement via Cloud Functions', done: true },
  { label: 'Chain ID and contract address configured', done: false },
  { label: 'Contract verification and execution model review', done: false },
  { label: 'On-chain settlement enabled', done: false },
]

const utilities = [
  { icon: Send, title: 'Settlement', body: 'Move value between VFXT wallets on-chain once enabled.' },
  { icon: PiggyBank, title: 'Staking', body: 'Configurable staking, released after calculation rules are verified.' },
  { icon: ArrowLeftRight, title: 'Swaps', body: 'Exchange via a modular adapter with server-side verification.' },
  { icon: Gamepad2, title: 'Gaming', body: 'Feature-flagged experiences powered by the same wallet.' },
]

function TokenCoin() {
  return (
    <div className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center">
      <div className="absolute inset-0 animate-spin-slow rounded-full border border-dashed border-white/20" />
      <div className="absolute inset-10 animate-spin-slow rounded-full border border-accent-bright/30 [animation-direction:reverse]" />
      {[0, 90, 180, 270].map((deg) => (
        <div key={deg} className="absolute inset-0 animate-spin-slow" style={{ rotate: `${deg}deg` }}>
          <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-bright shadow-[0_0_16px_#34d399]" />
        </div>
      ))}
      <div className="absolute inset-20 rounded-full bg-accent/40 blur-3xl" />
      <motion.div
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="relative grid size-40 place-items-center rounded-full bg-gradient-to-br from-accent-bright via-accent to-accent-strong shadow-[0_0_80px_rgb(52_211_153/0.45),inset_0_2px_0_rgb(255_255_255/0.4)] sm:size-48"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="grid size-[85%] place-items-center rounded-full border-2 border-white/30 bg-gradient-to-br from-accent to-accent-strong">
          <LogoMark className="size-16 sm:size-20" />
        </div>
      </motion.div>
    </div>
  )
}

function TokenDetails() {
  const enabled = env.VITE_FEATURE_BLOCKCHAIN_ENABLED
  const contract = env.VITE_VFXT_CONTRACT_ADDRESS
  const details = [
    { icon: Coins, label: 'Symbol', value: env.VITE_VFXT_TOKEN_SYMBOL },
    { icon: Hash, label: 'Decimals', value: env.VITE_VFXT_TOKEN_DECIMALS },
    { icon: Network, label: 'Chain ID', value: env.VITE_VFXT_CHAIN_ID || 'Not configured' },
    { icon: Link2, label: 'Contract', value: contract || 'Not configured', mono: true },
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card className="overflow-hidden">
        <div className="relative overflow-hidden bg-brand p-6 text-white">
          <div className="absolute -right-10 -top-10 size-40 rounded-full bg-accent/40 blur-3xl" />
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoMark className="size-11 ring-1 ring-white/15 rounded-lg" />
              <div>
                <p className="font-display text-lg font-bold">Virtual FX Trades</p>
                <p className="text-sm text-white/60">{env.VITE_VFXT_TOKEN_SYMBOL} · ERC-20</p>
              </div>
            </div>
            <Badge variant={enabled ? 'success' : 'warning'} className="border-white/10 bg-white/10 text-white">
              <span className={enabled ? 'size-1.5 rounded-full bg-accent-bright' : 'size-1.5 rounded-full bg-highlight'} />
              {enabled ? 'Network live' : 'Pre-launch'}
            </Badge>
          </div>
        </div>
        <CardContent className="p-6">
          <dl className="divide-y divide-line rounded-xl border border-line">
            {details.map(({ icon: Icon, label, value, mono }) => (
              <div key={label} className="flex items-center justify-between gap-4 px-4 py-3.5 text-sm">
                <dt className="flex items-center gap-2.5 text-ink-muted">
                  <Icon className="size-4" />
                  {label}
                </dt>
                <dd className="flex min-w-0 items-center gap-2">
                  <span className={mono ? 'truncate font-mono text-xs font-medium' : 'font-semibold'}>{value}</span>
                  {mono && contract ? (
                    <button
                      type="button"
                      aria-label="Copy contract address"
                      className="text-ink-subtle hover:text-ink"
                      onClick={async () => {
                        await navigator.clipboard.writeText(contract)
                        toast.success('Contract address copied')
                      }}
                    >
                      <Copy className="size-3.5" />
                    </button>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Launch roadmap</CardTitle>
          <CardDescription>On-chain features ship only after each gate is verified.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <div className="flex justify-between text-xs font-medium text-ink-muted">
              <span>Progress</span>
              <span>
                <CountUp value={roadmap.filter((s) => s.done).length} /> of {roadmap.length}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-elevated">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent to-accent-bright"
                initial={{ width: 0 }}
                whileInView={{ width: `${(roadmap.filter((s) => s.done).length / roadmap.length) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
          <ol className="space-y-4">
            {roadmap.map((step) => (
              <li key={step.label} className="flex gap-3 text-sm">
                {step.done ? (
                  <CheckCircle2 className="size-5 shrink-0 text-accent" />
                ) : (
                  <Circle className="size-5 shrink-0 text-line-strong" />
                )}
                <span className={step.done ? 'font-medium' : 'text-ink-muted'}>{step.label}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}

function Utilities({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-4' : 'grid gap-5 sm:grid-cols-2'}>
      {utilities.map(({ icon: Icon, title, body }, i) => (
        <Reveal
          key={title}
          delay={i * 0.06}
          className="group rounded-2xl border border-line bg-panel p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
        >
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
              <Icon className="size-5" />
            </span>
            <span className="rounded-full bg-panel-elevated px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Planned
            </span>
          </div>
          <p className="mt-5 font-semibold">{title}</p>
          <p className="mt-1 text-sm text-ink-muted">{body}</p>
        </Reveal>
      ))}
    </div>
  )
}

const intro =
  'The VFXT ERC-20 contract lives in a separately tested project. Off-chain balances and settlement remain under Cloud Functions until chain ID, contract address, verification, and execution models are reviewed.'

export function TokenPublicPage() {
  const inApp = useLocation().pathname.startsWith('/app')

  if (inApp) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Token" title="VFXT token" description={intro} />
        <TokenDetails />
        <div>
          <h2 className="mb-4 text-lg">What VFXT will power</h2>
          <Utilities compact />
        </div>
      </div>
    )
  }

  return (
    <>
      <MarketingHero
        eyebrow="VFXT token"
        title="The VFXT token, built to be"
        rotate={['verified first', 'audited', 'transparent']}
        description={intro}
        video={videos.cryptoGraphs}
        poster={images.cryptoDesk}
        aside={<TokenCoin />}
      />
      <StatsBand
        items={[
          { value: Number(env.VITE_VFXT_TOKEN_DECIMALS) || 0, label: 'Token decimals' },
          { value: roadmap.filter((s) => s.done).length, suffix: ` / ${roadmap.length}`, label: 'Launch gates passed' },
          { value: utilities.length, label: 'Planned utilities' },
          { value: 20, prefix: 'ERC-', label: 'Token standard' },
        ]}
      />
      <section className="container-page py-24">
        <SectionHeading eyebrow="Token details" title="Configuration & launch status" className="mb-14" />
        <Reveal>
          <TokenDetails />
        </Reveal>
      </section>
      <section className="border-y border-line bg-panel">
        <div className="container-page grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Utility"
              title="What VFXT will power"
              description="Each capability plugs into the same wallets and ledger you already use — and stays switched off until it is independently verified."
              className="mb-10"
            />
            <Utilities />
          </div>
          <Reveal delay={0.1}>
            <ParallaxImage src={images.blockchain} alt="Blockchain network illustration" className="aspect-[4/5] rounded-3xl shadow-lift" />
          </Reveal>
        </div>
      </section>
      <section className="pt-24">
        <CtaBand
          title="Be ready when VFXT goes live"
          description="Open an account today. Your VFXT wallet is provisioned alongside USD from day one."
          video={videos.cryptoGraphs}
          poster={images.cryptoDesk}
        />
      </section>
    </>
  )
}
