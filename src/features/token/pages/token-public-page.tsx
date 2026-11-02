import { useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftRight,
  CheckCircle2,
  Circle,
  Gamepad2,
  PiggyBank,
  Send,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { LogoTile } from '@/components/shared/logo'
import { Reveal } from '@/components/motion/reveal'
import { CtaBand, MarketingHero, SectionHeading, StatsBand } from '@/features/marketing/marketing-hero'
import { PhoneShowcaseBand, WalletPhone } from '@/features/marketing/phone-mockup'
import { TokenFactsGrid } from '@/features/marketing/token-facts'
import { CountUp } from '@/components/motion/reveal'
import { env } from '@/lib/env'
import { images, videos } from '@/lib/media'
import { VFXT_TOKEN } from '@/lib/vfxt-token'

function buildRoadmap(contractConfigured: boolean, blockchainEnabled: boolean) {
  return [
    { label: 'ERC-20 contract written and unit tested', done: true },
    { label: 'App balances settle securely on the platform', done: true },
    { label: 'Chain ID and contract address configured', done: contractConfigured },
    { label: 'Contract verification and execution model review', done: contractConfigured },
    { label: 'On-chain settlement enabled', done: blockchainEnabled },
  ]
}

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
          <span className="absolute left-1/2 top-0 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-bright" />
        </div>
      ))}
      <motion.div
        animate={{ rotateY: [0, 360] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        className="relative grid size-40 place-items-center rounded-full bg-gradient-to-br from-accent-bright via-accent to-accent-strong ring-1 ring-white/30 shadow-lift sm:size-48"
        style={{ transformStyle: 'preserve-3d' }}
      >
        <div className="grid size-[85%] place-items-center rounded-full border-2 border-white/30 bg-gradient-to-br from-accent to-accent-strong">
          <LogoTile className="size-16 sm:size-20 rounded-[22%]" />
        </div>
      </motion.div>
    </div>
  )
}

function TokenDetails() {
  const enabled = env.VITE_FEATURE_BLOCKCHAIN_ENABLED
  const contract = env.VITE_VFXT_CONTRACT_ADDRESS || VFXT_TOKEN.address
  const chainId = env.VITE_VFXT_CHAIN_ID || String(VFXT_TOKEN.chainId)
  const contractConfigured = Boolean(contract && chainId)
  const roadmap = buildRoadmap(contractConfigured, enabled)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <Card className="overflow-hidden">
        <div className="relative overflow-hidden bg-brand p-6 text-white">
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <LogoTile className="size-11 rounded-lg" />
              <div>
                <p className="font-display text-lg font-bold">
                  {VFXT_TOKEN.name} / {VFXT_TOKEN.symbol}
                </p>
                <p className="text-sm text-white/60">
                  BEP-20 · {VFXT_TOKEN.networkLabel} · {VFXT_TOKEN.decimals} decimals
                </p>
              </div>
            </div>
            <Badge variant={contractConfigured ? 'success' : 'warning'} className="border-white/10 bg-white/10 text-white">
              <span
                className={
                  contractConfigured ? 'size-1.5 rounded-full bg-accent-bright' : 'size-1.5 rounded-full bg-highlight'
                }
              />
              {contractConfigured ? 'Verified on BscScan' : 'Pre-launch'}
            </Badge>
          </div>
        </div>
        <CardContent className="p-6">
          <TokenFactsGrid />
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
          className="group rounded-2xl border border-line bg-panel p-6 shadow-card transition-[transform,background-color,border-color,color] duration-300 hover:-translate-y-1 hover:shadow-lift"
        >
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
              <Icon className="size-5" />
            </span>
            <span className="rounded-full bg-panel-elevated px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">
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

const intro = `${VFXT_TOKEN.name} is live on ${VFXT_TOKEN.networkLabel} as a fixed-supply BEP-20 token — ${VFXT_TOKEN.supply} (${VFXT_TOKEN.supplyShort}) minted once to the treasury.`

export function TokenPublicPage() {
  const inApp = useLocation().pathname.startsWith('/app')
  const contractConfigured = Boolean(
    (env.VITE_VFXT_CONTRACT_ADDRESS || VFXT_TOKEN.address) &&
      (env.VITE_VFXT_CHAIN_ID || String(VFXT_TOKEN.chainId)),
  )
  const roadmap = buildRoadmap(contractConfigured, env.VITE_FEATURE_BLOCKCHAIN_ENABLED)

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
          { value: VFXT_TOKEN.decimals, label: 'Token decimals' },
          { value: 10, suffix: 'T', label: 'Fixed total supply' },
          { value: roadmap.filter((s) => s.done).length, suffix: ` / ${roadmap.length}`, label: 'Launch gates passed' },
          { value: 20, prefix: 'BEP-', label: 'Token standard' },
        ]}
      />
      <section className="container-page py-24">
        <SectionHeading
          eyebrow="Token details"
          title={`${VFXT_TOKEN.name} on ${VFXT_TOKEN.networkLabel}`}
          description={`Fixed supply of ${VFXT_TOKEN.supply} (${VFXT_TOKEN.supplyShort}). Contract and treasury are verified on BscScan.`}
          className="mb-14"
        />
        <Reveal>
          <TokenDetails />
        </Reveal>
      </section>
      <PhoneShowcaseBand
        title="Hold VFXT in the Android wallet"
        description="Add the BEP-20 token on BNB Smart Chain, track it in Assets, and send or swap when you are ready."
        screens={['assets', 'home', 'send']}
      />

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
          <Reveal delay={0.1} className="relative mx-auto">
            <WalletPhone screen="assets" float />
            <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-accent/15 blur-3xl" />
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
