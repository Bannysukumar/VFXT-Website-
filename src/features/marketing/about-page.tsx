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
import { CtaBand, MarketingHero, SectionHeading, StatsBand } from '@/features/marketing/marketing-hero'
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
    body: 'Modular features for staking, swaps, and gaming — each disabled until independently verified.',
  },
]

const stack = [
  { icon: KeyRound, title: 'Authentication', body: 'Verified identity for every user and admin.' },
  { icon: Flame, title: 'Cloud Functions', body: 'Trusted execution for all financial workflows.' },
  { icon: Database, title: 'Firestore', body: 'Durable ledger records behind strict security rules.' },
  { icon: Blocks, title: 'ERC-20 contract', body: 'Separately tested for future on-chain settlement.' },
]

const milestones = [
  { title: 'Design system & public website', done: true },
  { title: 'Authentication, data models & security rules', done: true },
  { title: 'User and admin dashboards', done: true },
  { title: 'Ledger, deposit & withdrawal workflows', done: true },
  { title: 'VFXT token contract & tests', done: true },
  { title: 'Blockchain adapter & on-chain settlement', done: false },
]

export function AboutPage() {
  return (
    <>
      <MarketingHero
        eyebrow="About VFXT"
        title="A trading platform built on verifiable foundations"
        description="Virtual FX Trades pairs a familiar wallet experience with infrastructure where trusted servers — not browsers — decide every financial outcome."
        video={videos.analystRealtime}
        poster={images.tradingDesk}
      />

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
            description="Most platforms optimise for speed and hope the numbers add up. We start from the opposite end: every balance must be provable, every action auditable, and every new feature switched off until it has been verified."
          />
          <Reveal delay={0.1} className="mt-10 grid grid-cols-2 gap-6">
            {[
              ['Server-side', 'All financial decisions'],
              ['Immutable', 'Ledger & audit history'],
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

      {/* Architecture + timeline */}
      <section className="container-page grid gap-16 py-24 sm:py-32 lg:grid-cols-2">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Architecture"
            title="Firebase-first, chain-ready"
            description="Each layer has one responsibility, which keeps the system auditable today and lets on-chain settlement plug in later without rewriting the ledger."
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
            <p className="text-sm font-semiboldr text-accent-bright">Delivery progress</p>
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

      <CtaBand
        title="Join a platform that shows its work"
        description="Open an account and your wallets are created instantly — with every transaction recorded."
        video={videos.marketCloseUp}
        poster={images.laptopChart}
      />
    </>
  )
}
