import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BadgeCheck,
  CheckCircle2,
  Coins,
  FileLock2,
  Fingerprint,
  KeyRound,
  LifeBuoy,
  Lock,
  Play,
  Scale,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoBackground } from '@/components/motion/video-background'
import { CountUp, Marquee, Reveal } from '@/components/motion/reveal'
import {
  CinematicBand,
  CtaBand,
  Faq,
  SectionHeading,
  StorySplit,
} from '@/features/marketing/marketing-hero'
import { commonFaqs } from '@/features/marketing/content'
import { PhoneShowcaseBand, PhoneTrio, WalletPhone } from '@/features/marketing/phone-mockup'
import { RotatingWords } from '@/components/motion/typing'
import { images, videos } from '@/lib/media'

const ease = [0.22, 1, 0.36, 1] as const

const capabilities = [
  { icon: ShieldCheck, label: 'Server-enforced authorization' },
  { icon: Scale, label: 'Integer minor-unit ledger' },
  { icon: FileLock2, label: 'Immutable audit trail' },
  { icon: BadgeCheck, label: 'Admin-reviewed settlement' },
  { icon: KeyRound, label: 'Idempotent requests' },
  { icon: Fingerprint, label: 'Email-verified accounts' },
  { icon: Lock, label: 'Secrets never in the browser' },
  { icon: Coins, label: 'BEP-20 VFXT on BNB Chain' },
]

const stats = [
  { value: 100, suffix: '%', label: 'Server-authoritative balances' },
  { value: 5, suffix: '', label: 'Granular admin roles' },
  { value: 0, suffix: '', label: 'Floating-point money math' },
  { value: 2, suffix: '', label: 'Currencies: USD & VFXT' },
]

const products = [
  {
    title: 'Deposit USDT',
    body: 'Send BEP-20 USDT, submit your reference, and wait for finance review before the ledger credit lands.',
  },
  {
    title: 'Daily income stakes',
    body: 'Stake from your Deposit wallet. About 1% credits every 24 hours from your exact stake time into Daily ROI.',
  },
  {
    title: 'Internal transfers',
    body: 'Move value between your own wallets, or send VFXT and Withdrawal USD to another member by User ID.',
  },
  {
    title: 'Rank & referrals',
    body: 'Build your network, track team volume, and unlock rank benefits as your organisation grows.',
  },
]

const steps = [
  {
    image: images.teamLaptops,
    title: 'Create your account',
    body: 'Register with email, verify your address, and get USD ledger wallets plus VFXT provisioned automatically.',
  },
  {
    image: images.tradingDesk,
    title: 'Fund with USDT',
    body: 'Deposit on BNB Smart Chain with a clear reference. Finance admins approve before your available balance updates.',
  },
  {
    image: images.coins,
    title: 'Stake, earn, withdraw',
    body: 'Run daily income stakes, move funds between wallets, and withdraw to your saved BEP-20 destination.',
  },
]

function HeroPreview() {
  const points = [32, 38, 35, 46, 44, 52, 50, 61, 58, 67, 72, 70, 81]
  const max = Math.max(...points)
  const path = points
    .map((p, i) => `${(i / (points.length - 1)) * 300},${100 - (p / max) * 88}`)
    .join(' L ')

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="relative animate-float-slow rounded-2xl bg-white/[0.07] p-2 shadow-2xl backdrop-blur-xl">
        <div className="rounded-xl bg-panel p-5 text-ink">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-ink-muted">Available balance</p>
              <p className="tabular mt-1 font-display text-3xl font-bold">$24,580.00</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-accent" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
              </span>
              USD wallet
            </span>
          </div>
          <svg viewBox="0 0 300 100" className="mt-4 h-28 w-full" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" style={{ stopColor: 'var(--color-accent)' }} stopOpacity="0.28" />
                <stop offset="100%" style={{ stopColor: 'var(--color-accent)' }} stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d={`M ${path} L 300,100 L 0,100 Z`}
              fill="url(#hero-fill)"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.8 }}
            />
            <motion.path
              d={`M ${path}`}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.5, duration: 1.6, ease: 'easeInOut' }}
            />
          </svg>
          <div className="mt-3 space-y-1">
            {[
              { label: 'Deposit approved', meta: 'Finance review', amount: '+$5,000.00', inbound: true },
              { label: 'Withdrawal reserved', meta: 'Pending completion', amount: '−$1,200.00', inbound: false },
              { label: 'Deposit approved', meta: 'Finance review', amount: '+$2,500.00', inbound: true },
            ].map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9 + i * 0.15, duration: 0.5, ease }}
                className="flex items-center justify-between rounded-lg px-2 py-2 text-sm"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={
                      row.inbound
                        ? 'grid size-8 place-items-center rounded-lg bg-accent-soft text-accent'
                        : 'grid size-8 place-items-center rounded-lg bg-warning/10 text-warning'
                    }
                  >
                    {row.inbound ? <ArrowDownToLine className="size-4" /> : <ArrowUpFromLine className="size-4" />}
                  </span>
                  <div>
                    <p className="font-medium leading-tight">{row.label}</p>
                    <p className="text-xs text-ink-muted">{row.meta}</p>
                  </div>
                </div>
                <span className="tabular font-semibold">{row.amount}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.5, duration: 0.6, ease }}
        className="absolute -bottom-6 -left-4 hidden items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 text-ink shadow-lift sm:flex"
      >
        <span className="grid size-9 place-items-center rounded-full bg-accent text-white">
          <CheckCircle2 className="size-5" />
        </span>
        <div>
          <p className="text-xs font-semibold">Ledger write confirmed</p>
          <p className="text-[11px] text-ink-muted">Atomic and idempotent</p>
        </div>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.8, duration: 0.6, ease }}
        className="absolute -right-3 -top-5 hidden animate-float items-center gap-2 rounded-full border border-white/20 bg-brand/80 px-3.5 py-2 text-xs font-semibold text-white shadow-lift backdrop-blur sm:flex"
      >
        <ShieldCheck className="size-4 text-accent-bright" />
        Reviewed by finance
      </motion.div>
    </div>
  )
}

export function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative isolate overflow-hidden bg-brand text-white">
        <VideoBackground
          src={videos.forexBoard}
          poster={images.tradingChartDark}
          overlayClassName="bg-gradient-to-r from-brand from-20% via-brand/85 to-brand/60"
        />
        <div className="bg-grid absolute inset-0 [mask-image:radial-gradient(ellipse_at_top_left,black_20%,transparent_70%)]" />
        <div className="container-page relative grid min-h-[min(100dvh,960px)] items-center gap-16 pb-24 pt-32 lg:grid-cols-[1.1fr_1fr] lg:pt-28">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease }}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1 pl-1 pr-3 text-xs font-medium text-white/80 backdrop-blur"
            >
              <span className="flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                <Sparkles className="size-3" />
                New
              </span>
              Live on BNB Smart Chain
            </motion.div>
            <motion.h1
              className="mt-7 max-w-2xl text-[42px] font-extrabold leading-[1.04] tracking-tight text-balance text-white sm:text-6xl lg:text-7xl"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.8, ease }}
            >
              Trade with wallets you can{' '}
              <RotatingWords words={['actually trust', 'verify', 'audit', 'rely on']} className="text-gradient" />
            </motion.h1>
            <motion.p
              className="mt-7 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18, duration: 0.7, ease }}
            >
              Verified USDT deposits, daily income stakes, member transfers, and controlled withdrawals —
              all on an audited ledger where every balance is decided by trusted servers, not the browser.
            </motion.p>
            <motion.div
              className="mt-10 flex flex-wrap items-center gap-3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6, ease }}
            >
              <Button size="lg" variant="accent" asChild className="h-13 px-7">
                <Link to="/auth/register">
                  Open free account
                  <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="glass" asChild className="h-13 px-6">
                <a href="#how-it-works">
                  <span className="grid size-6 place-items-center rounded-full bg-white/15">
                    <Play className="size-3 fill-current" />
                  </span>
                  See how it works
                </a>
              </Button>
            </motion.div>
            <motion.div
              className="mt-12 flex items-center gap-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.6 }}
            >
              <div className="flex -space-x-2.5">
                {[images.teamLaptops, images.workingLaptop, images.officeTalk].map((src) => (
                  <img
                    key={src}
                    src={src.replace(/w=\d+/, 'w=96')}
                    alt=""
                    className="size-9 rounded-full border-2 border-brand object-cover"
                  />
                ))}
              </div>
              <p className="text-sm text-white/60">
                Built for traders who want <span className="font-semibold text-white">certainty</span>, not surprises.
              </p>
            </motion.div>
          </div>
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.25, duration: 0.9, ease }}
          >
            <HeroPreview />
          </motion.div>
        </div>
        <div className="relative border-t border-white/10 bg-brand/60 py-5 backdrop-blur">
          <Marquee>
            {capabilities.map(({ icon: Icon, label }) => (
              <span key={label} className="flex items-center gap-2.5 whitespace-nowrap text-sm font-medium text-white/70">
                <Icon className="size-4 text-accent-bright" />
                {label}
              </span>
            ))}
          </Marquee>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-line bg-panel">
        <div className="container-page grid grid-cols-2 divide-line py-14 lg:grid-cols-4 lg:divide-x">
          {stats.map((stat, i) => (
            <Reveal key={stat.label} delay={i * 0.08} className="px-4 py-4 text-center lg:py-0">
              <p className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
                <CountUp value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="mt-2 text-sm text-ink-muted">{stat.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Bento features */}
      <section className="container-page py-24 sm:py-32">
        <SectionHeading
          eyebrow="Platform"
          title="Everything you need to move money safely"
          description="Each workflow follows one rule: the frontend never decides a financial outcome. Trusted servers do."
        />
        <div className="mt-16 grid auto-rows-[minmax(260px,auto)] gap-5 md:grid-cols-3">
          <Reveal className="group relative isolate overflow-hidden rounded-3xl bg-brand text-white md:col-span-2 md:row-span-2">
            <VideoBackground
              src={videos.marketUi}
              poster={images.laptopChart}
              overlayClassName="bg-gradient-to-t from-brand via-brand/75 to-brand/30"
            />
            <div className="relative flex h-full min-h-[420px] flex-col justify-end p-8 sm:p-10">
              <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-accent-bright backdrop-blur">
                <Wallet className="size-6" />
              </span>
              <h3 className="mt-6 max-w-md text-2xl font-bold text-white sm:text-3xl">
                Multi-currency wallets with real-time ledger history
              </h3>
              <p className="mt-3 max-w-lg text-white/70">
                Deposit, Daily ROI, Withdrawal, and VFXT wallets are provisioned the moment your account
                is created. Available and reserved balances stay separate — every change writes an immutable ledger entry.
              </p>
            </div>
          </Reveal>
          {[
            {
              icon: ArrowDownToLine,
              title: 'Reviewed deposits',
              body: 'Finance admins verify each deposit before an atomic ledger credit is written.',
            },
            {
              icon: ArrowUpFromLine,
              title: 'Controlled withdrawals',
              body: 'Funds are reserved on request, so a balance can never be double-spent.',
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <Reveal
              key={title}
              delay={0.08 * (i + 1)}
              className="group flex flex-col rounded-3xl border border-line bg-panel p-8 shadow-card transition-[transform,background-color,border-color,color] duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                <Icon className="size-6" />
              </span>
              <h3 className="mt-auto pt-8 text-xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </Reveal>
          ))}
          {[
            {
              icon: KeyRound,
              title: 'Idempotent operations',
              body: 'Every request carries an idempotency key. Retries never duplicate a transaction.',
            },
            {
              icon: LifeBuoy,
              title: 'Built-in support',
              body: 'Open and track tickets from your dashboard, routed to dedicated support admins.',
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <Reveal
              key={title}
              delay={0.08 * i}
              className="group flex flex-col rounded-3xl border border-line bg-panel p-8 shadow-card transition-[transform,background-color,border-color,color] duration-300 hover:-translate-y-1 hover:shadow-lift"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent transition-colors duration-300 group-hover:bg-accent group-hover:text-white">
                <Icon className="size-6" />
              </span>
              <h3 className="mt-auto pt-8 text-xl">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
            </Reveal>
          ))}
          <Reveal
            delay={0.16}
            className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent to-accent-strong text-white"
          >
            <div className="pointer-events-none absolute -bottom-16 -right-8 w-[55%] rotate-6 opacity-90">
              <WalletPhone screen="assets" className="!w-full" />
            </div>
            <div className="relative flex h-full min-h-[280px] flex-col p-8">
              <span className="grid size-12 place-items-center rounded-xl bg-white/15 backdrop-blur">
                <Coins className="size-6" />
              </span>
              <h3 className="mt-auto max-w-[12rem] pt-8 text-xl text-white">VFXT on BNB Chain</h3>
              <p className="mt-2 max-w-[14rem] text-sm leading-relaxed text-white/80">
                BEP-20 VFXT is live — hold it in the Android wallet or on the platform ledger.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Product grid */}
      <section className="border-y border-line bg-panel">
        <div className="container-page py-24 sm:py-32">
          <SectionHeading
            eyebrow="What you can do"
            title="A complete member workspace"
            description="From first deposit to daily rewards and payouts — every tool sits behind the same server-authoritative ledger."
          />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map(({ title, body }, i) => (
              <Reveal
                key={title}
                delay={i * 0.06}
                className="rounded-3xl border border-line bg-canvas p-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-lift"
              >
                <span className="font-display text-3xl font-extrabold text-accent/30">0{i + 1}</span>
                <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <StorySplit
        title="Your money, visible at every step"
        description="See exactly where each request stands. Deposits, reservations, approvals, and completions are recorded as they happen — nothing changes behind your back."
        video={videos.dataPulse}
        poster={images.analyticsDashboard}
        bullets={[
          'Live ledger — every entry shows type, status, and resulting balances.',
          'Clear statuses — pending, approved, completed, or rejected, always explicit.',
          'Reserved funds — see what is held for in-flight withdrawals at a glance.',
          'Member transfers — send by User ID without guessing wallet addresses.',
        ]}
        cta={{ to: '/auth/register', label: 'Start in minutes' }}
      />

      <CinematicBand
        title="Daily income that follows your stake clock"
        description="Each stake earns on its own 24-hour cycle from the moment it was created — not a global batch. Credits land in your Daily ROI wallet until the day or payout cap is reached."
        video={videos.cityNight}
        poster={images.skyscrapers}
        points={[
          'About 1% credited every 24 hours',
          'Per-stake anniversary timing',
          'Deposit wallet → stake → Daily ROI',
          'Caps protect the programme',
        ]}
        cta={{ to: '/auth/register', label: 'Open an account' }}
      />

      {/* How it works */}
      <section id="how-it-works" className="container-page scroll-mt-20 py-24 sm:py-32">
        <SectionHeading
          eyebrow="How it works"
          title="How it works"
          description="From sign-up to your first withdrawal, every step is guided and verified."
        />
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.1} className="group">
              <div className="relative aspect-[4/3] overflow-hidden rounded-3xl">
                <img
                  src={step.image}
                  alt=""
                  loading="lazy"
                  className="size-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-brand/70 to-transparent" />
                <span className="absolute left-5 top-5 grid size-11 place-items-center rounded-full bg-panel font-display text-base font-bold text-ink shadow-lift">
                  {i + 1}
                </span>
              </div>
              <h3 className="mt-6 text-xl">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <StorySplit
        reverse
        title="Withdrawals that cannot double-spend"
        description="When you request a payout, funds move from available to reserved immediately. They leave only after review — or return if the request is rejected."
        video={videos.marketCloseUp}
        poster={images.candlesticks}
        bullets={[
          'Destination address saved after your first successful payout.',
          'Finance review before completion.',
          'Full history of reservations and releases in your ledger.',
          'Android wallet available for self-custody on EVM networks.',
        ]}
        cta={{ to: '/download', label: 'Get the Android wallet' }}
      />

      {/* Security with full-bleed video */}
      <section className="relative isolate overflow-hidden bg-brand py-24 text-white sm:py-32">
        <VideoBackground
          src={videos.analystRealtime}
          poster={images.candlesticks}
          overlayClassName="bg-gradient-to-r from-brand via-brand/90 to-brand/70"
        />
        <div className="container-page relative grid items-center gap-14 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              inverted
              eyebrow="Security"
              title="Built so the client cannot rewrite the ledger"
              description="Authorization rules, Cloud Functions, and App Check work together so no browser session can change a balance it should not."
            />
            <Reveal delay={0.1}>
              <ul className="mt-8 space-y-4">
                {[
                  ['Role-based admin access', 'Super, finance, operations, support, and read-only roles.'],
                  ['Atomic transactions', 'Ledger writes and balance updates commit together or not at all.'],
                  ['Secrets stay server-side', 'Credentials live in a secret manager, never in the browser.'],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-3">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-bright" />
                    <div>
                      <p className="font-semibold text-white">{title}</p>
                      <p className="text-sm text-white/60">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" variant="accent" className="mt-10">
                <Link to="/security">
                  Read the security model
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Fingerprint, title: 'Verified identity', body: 'Email-verified sign-in' },
              { icon: ShieldCheck, title: 'App Check', body: 'Only genuine app traffic' },
              { icon: FileLock2, title: 'Audit logs', body: 'Immutable action history' },
              { icon: Scale, title: 'Exact math', body: 'Integer minor units only' },
            ].map(({ icon: Icon, title, body }, i) => (
              <Reveal
                key={title}
                delay={i * 0.08}
                className="rounded-2xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur-md transition-colors hover:border-accent-bright/40 hover:bg-white/10"
              >
                <Icon className="size-7 text-accent-bright" />
                <p className="mt-10 font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm text-white/55">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <PhoneShowcaseBand
        title="Meet VFXT Wallet on Android"
        description="Self-custody portfolio, mining, and transfers — shown the way they appear on a phone."
        screens={['home', 'mining', 'send']}
      />

      <section className="border-y border-line bg-panel">
        <div className="container-page py-24 sm:py-32">
          <SectionHeading
            eyebrow="Android app"
            title="VFXT Wallet — self-custody on your phone"
            description="The Android app is a separate product from the web ledger: multi-chain send and receive, LI.FI swaps, device PIN security, and a Mining tab for VFXT sessions."
          />
          <div className="mt-10 hidden md:block">
            <PhoneTrio screens={['receive', 'home', 'security']} />
          </div>
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            <Reveal className="rounded-3xl border border-line bg-canvas p-8">
              <h3 className="text-2xl font-semibold">Wallet features</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Create or import BIP-39 wallets, manage multiple accounts, scan QR codes, add custom
                networks and tokens, and lock the app with PIN or biometrics. Keys stay encrypted on device.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-ink-muted">
                {[
                  'BNB Smart Chain default + major EVM chains',
                  'USDT, USDC, VFXT, and custom tokens',
                  'Swap and bridge via LI.FI',
                  'Official APK from the Download page only',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8">
                <Link to="/wallet">
                  Explore the wallet
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
            <Reveal delay={0.08} className="rounded-3xl border border-line bg-canvas p-8">
              <h3 className="text-2xl font-semibold">VFXT mining</h3>
              <p className="mt-3 text-sm leading-relaxed text-ink-muted">
                Run timed daily mining sessions in the wallet, track rewards, claim VFXT to your address,
                and optionally buy USDT speed boosters signed from the same self-custody wallet.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-ink-muted">
                {[
                  'Server-authoritative rates and caps',
                  'Claim when you clear the minimum',
                  'Separate from web daily income stakes',
                  'Wallet-signature account login',
                ].map((item) => (
                  <li key={item} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8" variant="outline">
                <Link to="/mining">
                  How mining works
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      <CinematicBand
        title="Support that stays inside your account"
        description="Open tickets from the dashboard, recover access by email, and read FAQs that cover deposits, stakes, transfers, withdrawals, and the Android wallet."
        video={videos.deskActivity}
        poster={images.supportDesk}
        invertOverlay
        points={['In-app tickets with status tracking', 'Password reset by email', 'Public FAQs & contact form']}
        cta={{ to: '/support', label: 'Visit support centre' }}
      />

      {/* FAQ */}
      <section className="container-page grid gap-12 py-24 sm:py-32 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHeading
            align="left"
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Can't find what you're looking for? Our support team is one ticket away."
          />
          <Reveal delay={0.1}>
            <Button asChild variant="outline" className="mt-8">
              <Link to="/support">Visit support centre</Link>
            </Button>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <Faq items={commonFaqs} />
        </Reveal>
      </section>

      <CtaBand
        title="Ready to open your VFXT account?"
        description="Create an account in minutes. Your wallets are provisioned instantly and every transaction is recorded."
        video={videos.skylinePan}
        poster={images.tradingDesk}
      />
    </>
  )
}
