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
import { CountUp, Marquee, ParallaxImage, Reveal } from '@/components/motion/reveal'
import { CtaBand, Faq, SectionHeading } from '@/features/marketing/marketing-hero'
import { commonFaqs } from '@/features/marketing/content'
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
  { icon: Coins, label: 'ERC-20 token ready' },
]

const stats = [
  { value: 100, suffix: '%', label: 'Server-authoritative balances' },
  { value: 5, suffix: '', label: 'Granular admin roles' },
  { value: 0, suffix: '', label: 'Floating-point money math' },
  { value: 2, suffix: '', label: 'Currencies: USD & VFXT' },
]

const steps = [
  {
    image: images.teamLaptops,
    title: 'Create your account',
    body: 'Register with email and verify your address. USD and VFXT wallets are provisioned for you automatically.',
  },
  {
    image: images.tradingDesk,
    title: 'Request a deposit',
    body: 'Submit an amount and reference. Finance admins review and approve it before your balance updates.',
  },
  {
    image: images.coins,
    title: 'Manage and withdraw',
    body: 'Follow every ledger entry in real time and request withdrawals to your verified destination.',
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
      <div className="absolute -inset-8 rounded-[2.5rem] bg-accent-bright/25 blur-3xl" aria-hidden />
      <div className="relative animate-float-slow rounded-2xl border border-white/15 bg-white/[0.07] p-2 shadow-2xl backdrop-blur-xl">
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
          <svg viewBox="0 0 300 100" className="mt-4 h-28 w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hero-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0e9f6e" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#0e9f6e" stopOpacity="0" />
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
              stroke="#0e9f6e"
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
          <p className="text-[11px] text-ink-muted">Atomic · idempotent</p>
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
          overlayClassName="bg-[radial-gradient(ellipse_at_top_right,rgb(14_159_110/0.35),transparent_55%),linear-gradient(100deg,rgb(10_25_21/0.97)_20%,rgb(10_25_21/0.8)_60%,rgb(10_25_21/0.6))]"
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
              VFXT token rails are on the roadmap
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
              Verified deposits, controlled withdrawals, and an audited ledger where every balance
              is server-authoritative — with VFXT token rails ready when the network is.
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
          <Reveal className="group relative overflow-hidden rounded-3xl bg-brand text-white md:col-span-2 md:row-span-2">
            <img
              src={images.laptopChart}
              alt="Trading chart on a laptop"
              loading="lazy"
              className="absolute inset-0 size-full object-cover opacity-50 transition-transform duration-[1.5s] ease-out group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-brand via-brand/70 to-transparent" />
            <div className="relative flex h-full flex-col justify-end p-8 sm:p-10">
              <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-accent-bright backdrop-blur">
                <Wallet className="size-6" />
              </span>
              <h3 className="mt-6 max-w-md text-2xl font-bold text-white sm:text-3xl">
                Multi-currency wallets with real-time ledger history
              </h3>
              <p className="mt-3 max-w-lg text-white/70">
                Available and reserved balances are tracked separately and provisioned the moment
                your account is created. Every change is backed by an immutable ledger entry.
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
              className="group flex flex-col rounded-3xl border border-line bg-panel p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
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
              className="group flex flex-col rounded-3xl border border-line bg-panel p-8 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-lift"
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
            <img
              src={images.phoneMarkets}
              alt="Markets app on a phone"
              loading="lazy"
              className="absolute -bottom-10 -right-10 w-2/3 rotate-6 rounded-2xl opacity-40 shadow-2xl transition-transform duration-700 group-hover:-translate-y-2 group-hover:rotate-3"
            />
            <div className="relative flex h-full flex-col p-8">
              <span className="grid size-12 place-items-center rounded-xl bg-white/15 backdrop-blur">
                <Coins className="size-6" />
              </span>
              <h3 className="mt-auto pt-8 text-xl text-white">VFXT token ready</h3>
              <p className="mt-2 max-w-[16rem] text-sm leading-relaxed text-white/80">
                A tested ERC-20 contract awaits network review for on-chain settlement.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Split showcase */}
      <section className="overflow-hidden border-y border-line bg-panel">
        <div className="container-page grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-2">
          <Reveal className="relative">
            <ParallaxImage
              src={images.analyticsDashboard}
              alt="Analytics dashboard on a screen"
              className="aspect-[4/3] rounded-3xl shadow-lift"
            />
            <div className="absolute -bottom-8 -right-4 w-60 animate-float rounded-2xl border border-line bg-panel p-4 shadow-lift sm:-right-8">
              <p className="text-xs font-medium text-ink-muted">Withdrawal status</p>
              <div className="mt-3 space-y-2.5">
                {['Requested', 'Funds reserved', 'Admin approved'].map((step, i) => (
                  <div key={step} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className={i < 2 ? 'size-4 text-accent' : 'size-4 text-line-strong'} />
                    <span className={i < 2 ? 'font-medium' : 'text-ink-muted'}>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
          <div>
            <SectionHeading
              align="left"
              eyebrow="Transparency"
              title="Your money, visible at every step"
              description="See exactly where each request stands. Deposits, reservations, approvals, and completions are recorded as they happen — nothing changes behind your back."
            />
            <Reveal delay={0.1}>
              <ul className="mt-8 space-y-5">
                {[
                  ['Live ledger', 'Every entry shows its type, status, and resulting balance.'],
                  ['Clear statuses', 'Pending, approved, completed, or rejected — always explicit.'],
                  ['Reserved funds', 'See what is held for in-flight withdrawals at a glance.'],
                ].map(([title, body]) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                      <CheckCircle2 className="size-4" />
                    </span>
                    <div>
                      <p className="font-semibold">{title}</p>
                      <p className="text-sm text-ink-muted">{body}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-10">
                <Link to="/auth/register">
                  Start in minutes
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="container-page scroll-mt-20 py-24 sm:py-32">
        <SectionHeading
          eyebrow="How it works"
          title="Up and running in three steps"
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
                  className="size-full object-cover transition-transform duration-700 group-hover:scale-105"
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
              title="Integrity designed into every layer"
              description="Authorization rules, Cloud Functions, and App Check work together so no client can change a balance it should not."
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

      {/* FAQ */}
      <section className="container-page grid gap-12 py-24 sm:py-32 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <SectionHeading
            align="left"
            eyebrow="FAQ"
            title="Questions, answered"
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
        video={videos.floatingIndicators}
        poster={images.tradingDesk}
      />
    </>
  )
}
