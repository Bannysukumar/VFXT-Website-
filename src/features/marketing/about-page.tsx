import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Blocks,
  CheckCircle2,
  Circle,
  Database,
  Flame,
  KeyRound,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ParallaxImage, Reveal } from '@/components/motion/reveal'
import {
  CinematicBand,
  CtaBand,
  MarketingHero,
  SectionHeading,
  StatsBand,
  StorySplit,
} from '@/features/marketing/marketing-hero'
import { PhoneShowcaseBand, PhoneTrio } from '@/features/marketing/phone-mockup'
import { images, videos } from '@/lib/media'

const values = [
  {
    icon: ShieldCheck,
    title: 'Security first',
    body: 'Server-enforced authorization, App Check, and immutable audit logs protect every account action.',
  },
  {
    icon: Scale,
    title: 'Ledger integrity',
    body: 'Integer minor units, idempotent operations, and atomic transactions keep balances exact.',
  },
  {
    icon: Blocks,
    title: 'Expandable by design',
    body: 'Staking, ranks, referrals, and the Android wallet ship behind the same ledger rules — new rails only after review.',
  },
]

const stack = [
  { icon: KeyRound, title: 'Authentication', body: 'Verified identity for every user and admin.' },
  { icon: Flame, title: 'Cloud Functions', body: 'Trusted execution for all financial workflows.' },
  { icon: Database, title: 'Firestore', body: 'Durable ledger records behind strict security rules.' },
  { icon: Blocks, title: 'BEP-20 VFXT', body: 'Live on BNB Smart Chain; app settlement expands carefully.' },
]

const milestones = [
  { title: 'Design system & public website', done: true },
  { title: 'Authentication, data models & security rules', done: true },
  { title: 'User and admin dashboards', done: true },
  { title: 'Ledger, deposit, stake & withdrawal workflows', done: true },
  { title: 'VFXT BEP-20 token on BNB Smart Chain', done: true },
  { title: 'Broader on-chain settlement for every product flow', done: false },
]

export function AboutPage() {
  return (
    <>
      <MarketingHero
        eyebrow="About VFXT"
        title="A trading platform built on verifiable foundations"
        description="Virtual FX Trades pairs a familiar wallet experience with infrastructure where trusted servers — not browsers — decide every financial outcome. USDT deposits, daily stakes, transfers, and withdrawals all share one audited ledger."
        video={videos.analystRealtime}
        poster={images.tradingDesk}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" variant="accent" asChild>
            <Link to="/auth/register">
              Open free account
              <ArrowRight />
            </Link>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <Link to="/security">Security model</Link>
          </Button>
        </div>
      </MarketingHero>

      <StatsBand
        items={[
          { value: milestones.filter((m) => m.done).length, suffix: ` / ${milestones.length}`, label: 'Delivery phases shipped' },
          { value: stack.length, label: 'Platform layers' },
          { value: values.length, label: 'Core principles' },
          { value: 5, label: 'Admin roles' },
        ]}
      />

      {/* Mission with image mosaic */}
      <section className="container-page grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Our mission"
            title="Make digital money movement boringly reliable"
            description="Most platforms optimise for speed and hope the numbers add up. We start from the opposite end: every balance must be provable, every action auditable, and every new feature verified before it touches real funds."
          />
          <Reveal delay={0.1} className="mt-10 grid grid-cols-2 gap-6">
            {[
              ['Server-side', 'All financial decisions'],
              ['Immutable', 'Ledger & audit history'],
              ['Member-first', 'Clear statuses, no surprises'],
              ['Chain-aware', 'BEP-20 VFXT + USDT rails'],
            ].map(([title, body]) => (
              <div key={title} className="border-l-2 border-accent pl-4">
                <p className="font-display text-2xl font-bold">{title}</p>
                <p className="mt-1 text-sm text-ink-muted">{body}</p>
              </div>
            ))}
          </Reveal>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Reveal className="space-y-4">
            <ParallaxImage src={images.teamHighFive} alt="Team celebrating" className="aspect-[3/4] rounded-3xl" strength={30} />
            <ParallaxImage src={images.handshake} alt="Business handshake" className="aspect-square rounded-3xl" strength={20} />
          </Reveal>
          <Reveal delay={0.15} className="space-y-4 pt-12">
            <ParallaxImage src={images.skyscrapers} alt="Financial district towers" className="aspect-square rounded-3xl" strength={20} />
            <ParallaxImage src={images.teamLaptops} alt="Team working on laptops" className="aspect-[3/4] rounded-3xl" strength={30} />
          </Reveal>
        </div>
      </section>

      <CinematicBand
        title="Built for traders who want certainty"
        description="We treat every deposit, stake credit, transfer, and withdrawal as a state machine with an audit trail — so balances stay explainable under pressure."
        video={videos.cityNight}
        poster={images.skyscrapers}
        points={[
          'Finance-reviewed USDT deposits',
          'Per-stake 24-hour daily income',
          'Member transfers by User ID',
          'Reserved withdrawals, no double-spend',
        ]}
        cta={{ to: '/auth/register', label: 'Join VFXT' }}
      />

      {/* Values */}
      <section className="border-y border-line bg-panel">
        <div className="container-page py-24 sm:py-32">
          <SectionHeading eyebrow="What we value" title="What we value" />
          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {values.map(({ icon: Icon, title, body }, i) => (
              <Reveal
                key={title}
                delay={i * 0.08}
                className="group relative overflow-hidden rounded-3xl border border-line bg-canvas p-8 transition-[transform,background-color,border-color,color] duration-300 hover:-translate-y-1 hover:bg-panel hover:shadow-lift"
              >
                <span className="absolute -right-4 -top-6 font-display text-[120px] font-extrabold leading-none text-line/70">
                  0{i + 1}
                </span>
                <span className="relative grid size-12 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/25">
                  <Icon className="size-6" />
                </span>
                <h3 className="relative mt-8 text-xl">{title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <StorySplit
        title="People, process, and platform"
        description="Behind the product is a deliberate delivery model: ship the ledger and admin controls first, then layer member products, then expand on-chain settlement without rewriting history."
        video={videos.deskActivity}
        poster={images.officeTalk}
        bullets={[
          'Public site and member app share one design system.',
          'Admins work from role-scoped queues, not shared passwords.',
          'Token contract and wallet APK are published with clear provenance.',
          'Support tickets stay inside authenticated accounts.',
        ]}
        cta={{ to: '/contact', label: 'Talk to the team' }}
      />

      {/* Architecture + timeline */}
      <section className="container-page grid gap-16 py-24 sm:py-32 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Architecture"
            title="Firebase-first, chain-aware"
            description="Each layer has one responsibility, which keeps the system auditable today and lets broader on-chain settlement expand without rewriting the ledger."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {stack.map(({ icon: Icon, title, body }, i) => (
              <Reveal
                key={title}
                delay={i * 0.06}
                className="rounded-2xl border border-line bg-panel p-5 shadow-card transition-colors hover:border-accent/40"
              >
                <Icon className="size-6 text-accent" />
                <p className="mt-4 font-semibold">{title}</p>
                <p className="mt-1 text-sm text-ink-muted">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={0.1} className="relative overflow-hidden rounded-3xl bg-brand p-8 text-white sm:p-10">
          <img src={images.blockchain} alt="" className="absolute inset-0 size-full object-cover opacity-20" />
          <div className="absolute inset-0 bg-gradient-to-br from-brand via-brand/90 to-brand/70" />
          <div className="relative">
            <p className="text-sm font-semibold text-accent-bright">Delivery progress</p>
            <h3 className="mt-3 text-2xl text-white">Shipped in deliberate phases</h3>
            <ol className="relative mt-8 space-y-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-px before:bg-white/15">
              {milestones.map((m) => (
                <li key={m.title} className="relative flex items-center gap-4">
                  {m.done ? (
                    <CheckCircle2 className="relative size-6 shrink-0 rounded-full bg-brand text-accent-bright" />
                  ) : (
                    <Circle className="relative size-6 shrink-0 rounded-full bg-brand text-white/30" />
                  )}
                  <span className={m.done ? 'text-white' : 'text-white/50'}>{m.title}</span>
                  {!m.done ? (
                    <span className="ml-auto rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/70">
                      Next
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
            <Button asChild variant="light" className="mt-10">
              <Link to="/token">
                Explore the token roadmap
                <ArrowRight />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <PhoneShowcaseBand
        title="The Android product, in product frames"
        description="Wallet home, mining, and security — the surfaces members use every day on VFXT Wallet."
        screens={['home', 'mining', 'security']}
      />

      <section className="border-t border-line bg-panel">
        <div className="container-page py-24 sm:py-32">
          <SectionHeading
            eyebrow="Product family"
            title="One brand. Two surfaces."
            description="Virtual FX Trades is the web platform for ledger balances and member programmes. VFXT Wallet is the Android self-custody app for on-chain assets and mining."
          />
          <div className="mt-10">
            <PhoneTrio screens={['assets', 'send', 'receive']} />
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              {
                title: 'Web platform',
                body: 'Email accounts, Deposit / Daily ROI / Withdrawal / VFXT ledgers, deposits, stakes, referrals, ranks, and reviewed payouts.',
                to: '/auth/register',
                cta: 'Create account',
              },
              {
                title: 'Android wallet',
                body: 'BIP-39 keys on device, multi-chain EVM send and receive, LI.FI swaps, PIN and biometrics, custom networks and tokens.',
                to: '/wallet',
                cta: 'Wallet features',
              },
              {
                title: 'VFXT mining',
                body: 'Timed mining sessions inside the wallet, reward claims to your address, and optional USDT speed boosters you sign yourself.',
                to: '/mining',
                cta: 'Mining overview',
              },
            ].map(({ title, body, to, cta }, i) => (
              <Reveal
                key={title}
                delay={i * 0.06}
                className="flex flex-col rounded-3xl border border-line bg-canvas p-7"
              >
                <h3 className="text-xl font-semibold">{title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-muted">{body}</p>
                <Button asChild variant="outline" className="mt-6 w-fit">
                  <Link to={to}>
                    {cta}
                    <ArrowRight />
                  </Link>
                </Button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Join a platform that shows its work"
        description="Open an account and your wallets are created instantly — with every transaction recorded."
        video={videos.skylinePan}
        poster={images.laptopChart}
      />
    </>
  )
}
