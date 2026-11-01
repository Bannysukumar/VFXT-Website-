import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDown,
  ArrowRight,
  Bug,
  Check,
  CheckCircle2,
  Database,
  FileLock2,
  Fingerprint,
  KeyRound,
  Lock,
  Minus,
  MonitorSmartphone,
  ScrollText,
  Server,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoBackground } from '@/components/motion/video-background'
import { ParallaxImage, Reveal } from '@/components/motion/reveal'
import {
  CinematicBand,
  CtaBand,
  MarketingHero,
  SectionHeading,
  StatsBand,
  StorySplit,
} from '@/features/marketing/marketing-hero'
import { PhonePair, WalletPhone } from '@/features/marketing/phone-mockup'
import { images, videos } from '@/lib/media'
import { cn } from '@/lib/utils'

const ease = [0.22, 1, 0.36, 1] as const

const layers: { icon: LucideIcon; title: string; body: string; tag: string }[] = [
  {
    icon: MonitorSmartphone,
    title: 'Your browser',
    body: 'Displays balances and submits requests. It can never write a balance or ledger entry.',
    tag: 'Untrusted',
  },
  {
    icon: Fingerprint,
    title: 'Authentication & App Check',
    body: 'Every call carries a verified identity token, and App Check rejects traffic that does not come from the genuine app.',
    tag: 'Identity',
  },
  {
    icon: Server,
    title: 'Cloud Functions',
    body: 'Validates input, checks the caller’s role, enforces idempotency, and is the only code allowed to move money.',
    tag: 'Trusted',
  },
  {
    icon: Database,
    title: 'Firestore ledger',
    body: 'Wallet and ledger documents are read-only to clients. Balance changes and ledger entries commit in one atomic transaction.',
    tag: 'Durable',
  },
  {
    icon: ScrollText,
    title: 'Audit log',
    body: 'Each privileged action writes an immutable record of who did what, to which resource, and when.',
    tag: 'Immutable',
  },
]

const roles = ['Super', 'Finance', 'Operations', 'Support', 'Read-only'] as const

const matrix: { action: string; allowed: (typeof roles)[number][] }[] = [
  { action: 'Approve or reject deposits', allowed: ['Super', 'Finance'] },
  { action: 'Approve, complete, or reject withdrawals', allowed: ['Super', 'Finance'] },
  { action: 'View pending finance queues', allowed: ['Super', 'Finance', 'Read-only'] },
  { action: 'Update support ticket status', allowed: ['Super', 'Operations', 'Support'] },
  { action: 'Read audit logs', allowed: ['Super', 'Finance', 'Operations', 'Support'] },
  { action: 'View users and platform statistics', allowed: ['Super', 'Finance', 'Operations', 'Support', 'Read-only'] },
  { action: 'Assign admin roles', allowed: ['Super'] },
]

const depositFlow = [
  { state: 'Requested', body: 'You submit an amount. A pending deposit is created server-side with an idempotency key.' },
  { state: 'Reviewed', body: 'A finance admin verifies the incoming payment against the request.' },
  { state: 'Credited', body: 'Approval writes the ledger credit and updates your available balance atomically.' },
]

const withdrawalFlow = [
  { state: 'Reserved', body: 'Funds move from available to reserved, so they cannot be spent twice.' },
  { state: 'Approved', body: 'A finance admin checks the destination and amount.' },
  { state: 'Completed', body: 'Funds are sent and the reservation is cleared — or released back if rejected.' },
]

function FlowColumn({ title, steps, icon: Icon }: { title: string; steps: typeof depositFlow; icon: LucideIcon }) {
  return (
    <Reveal className="rounded-3xl border border-line bg-panel p-7 shadow-card">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/25">
          <Icon className="size-5" />
        </span>
        <h3 className="text-xl">{title}</h3>
      </div>
      <ol className="mt-8 space-y-2">
        {steps.map((step, i) => (
          <li key={step.state}>
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.15, duration: 0.5, ease }}
              className="flex gap-4 rounded-2xl border border-line bg-canvas p-4"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand font-display text-xs font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-semibold">{step.state}</p>
                <p className="mt-0.5 text-sm text-ink-muted">{step.body}</p>
              </div>
            </motion.div>
            {i < steps.length - 1 ? (
              <ArrowDown className="mx-auto my-1 size-4 text-ink-subtle" />
            ) : null}
          </li>
        ))}
      </ol>
      <p className="mt-5 flex items-center gap-2 rounded-xl bg-danger/5 px-4 py-3 text-sm text-ink-muted">
        <XCircle className="size-4 shrink-0 text-danger" />
        A rejected request is closed with a recorded reason and never changes your available balance.
      </p>
    </Reveal>
  )
}

function BalanceModel() {
  return (
    <Reveal className="relative overflow-hidden rounded-3xl bg-brand p-8 text-white shadow-lift sm:p-10">
      <p className="relative text-sm font-semiboldr text-accent-bright">Example wallet</p>
      <div className="relative mt-6 space-y-6">
        {[
          { label: 'Available', value: '$4,000.00', pct: 80, color: 'bg-accent-bright', note: 'Spendable and withdrawable' },
          { label: 'Reserved', value: '$1,000.00', pct: 20, color: 'bg-highlight', note: 'Held for a pending withdrawal' },
        ].map((row, i) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between">
              <p className="font-semibold">{row.label}</p>
              <p className="tabular font-display text-2xl font-bold">{row.value}</p>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className={cn('h-full rounded-full', row.color)}
                initial={{ width: 0 }}
                whileInView={{ width: `${row.pct}%` }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.2, duration: 1.1, ease: 'easeOut' }}
              />
            </div>
            <p className="mt-1.5 text-xs text-white/55">{row.note}</p>
          </div>
        ))}
      </div>
      <div className="relative mt-8 rounded-2xl border border-white/10 bg-white/5 p-4 font-mono text-xs leading-relaxed text-white/70">
        <p className="text-white/40">// stored as integer minor units</p>
        <p>
          availableMinor: <span className="text-accent-bright">400000</span>
        </p>
        <p>
          reservedMinor: <span className="text-highlight">100000</span>
        </p>
        <p>scale: 2</p>
      </div>
      <p className="relative mt-4 text-xs text-white/40">Illustrative figures only.</p>
    </Reveal>
  )
}

export function SecurityPage() {
  return (
    <>
      <MarketingHero
        eyebrow="Security & trust"
        title="Built so no browser can"
        rotate={['move your money', 'edit a balance', 'skip a review']}
        description="Here is exactly how VFXT protects balances: who is allowed to change them, how every request is reviewed, and how every privileged action is recorded."
        video={videos.marketCloseUp}
        poster={images.candlesticks}
        aside={<PhonePair front="security" back="home" />}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" variant="accent" asChild>
            <a href="#architecture">
              See the architecture
              <ArrowDown />
            </a>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <Link to="/legal/risk">Read the risk disclosure</Link>
          </Button>
        </div>
      </MarketingHero>

      <StatsBand
        items={[
          { value: 5, label: 'Security layers per request' },
          { value: 5, label: 'Least-privilege admin roles' },
          { value: 0, label: 'Client writes to balances' },
          { value: 100, suffix: '%', label: 'Privileged actions audited' },
        ]}
      />

      <CinematicBand
        title="Trust the server, not the screen"
        description="Balances you see in the app are a projection of server state. Changing what renders in the browser cannot invent credits, skip reservations, or approve a withdrawal."
        video={videos.dataPulse}
        poster={images.blockchain}
        points={[
          'Firestore rules block client wallet writes',
          'Cloud Functions own every money move',
          'App Check rejects forged clients',
          'Audit log is append-only',
        ]}
      />

      {/* Principles strip */}
      <section className="border-b border-line bg-panel">
        <div className="container-page grid gap-6 py-10 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Lock, title: 'Client writes blocked', body: 'Security rules deny all client writes to wallets and ledger.' },
            { icon: KeyRound, title: 'Idempotent requests', body: 'Retries are recognised and never duplicated.' },
            { icon: ShieldCheck, title: 'Role-based approvals', body: 'Only finance roles can move funds.' },
            { icon: FileLock2, title: 'Immutable audit trail', body: 'Privileged actions are logged permanently.' },
          ].map(({ icon: Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.06} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent" />
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-ink-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section id="architecture" className="container-page scroll-mt-20 py-24 sm:py-32">
        <SectionHeading
          eyebrow="Architecture"
          title="Five layers between a click and your balance"
          description="Each request passes through every layer below. Trust increases as you move down — and only the trusted layers can change money."
        />
        <div className="relative mx-auto mt-16 max-w-3xl">
          <motion.div
            className="absolute bottom-8 left-[27px] top-8 w-0.5 origin-top bg-gradient-to-b from-line-strong via-accent to-accent-strong sm:left-[31px]"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 1.6, ease: 'easeInOut' }}
          />
          <ol className="space-y-5">
            {layers.map(({ icon: Icon, title, body, tag }, i) => (
              <Reveal key={title} delay={i * 0.12} className="relative flex gap-5">
                <span
                  className={cn(
                    'relative z-10 grid size-14 shrink-0 place-items-center rounded-2xl shadow-card sm:size-16',
                    i === 0 ? 'border border-line bg-panel text-ink-muted' : 'bg-brand text-accent-bright',
                  )}
                >
                  <Icon className="size-6" />
                </span>
                <div className="flex-1 rounded-2xl border border-line bg-panel p-5 shadow-card transition-shadow hover:shadow-lift">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-lg">{title}</h3>
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                        i === 0 ? 'bg-warning/10 text-warning' : 'bg-accent-soft text-accent',
                      )}
                    >
                      {tag}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Balance model */}
      <section className="border-y border-line bg-panel">
        <div className="container-page grid items-center gap-16 py-24 sm:py-32 lg:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="How balances work"
              title="How balances work"
              description="Each wallet has two numbers. Available is what you can use; reserved is held for withdrawals in progress. Both are stored as whole integers of the smallest unit — never as floating-point numbers that can drift."
            />
            <Reveal delay={0.1}>
              <ul className="mt-8 space-y-4">
                {[
                  'Balances only change inside a server transaction that also writes the matching ledger entry.',
                  'Every ledger entry records the resulting available and reserved balance, so history can be replayed and verified.',
                  'Ledger entries are append-only: corrections are new entries, never edits.',
                ].map((text) => (
                  <li key={text} className="flex gap-3 text-sm">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" />
                    <span className="text-ink-muted">{text}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
          <BalanceModel />
        </div>
      </section>

      {/* Approval flows */}
      <section className="container-page py-24 sm:py-32">
        <SectionHeading
          eyebrow="Approvals"
          title="Every movement of money is reviewed by a person"
          description="Deposits and withdrawals follow fixed state machines. The server refuses any transition that is not allowed from the current state."
        />
        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <FlowColumn title="Deposits" steps={depositFlow} icon={ArrowDown} />
          <FlowColumn title="Withdrawals" steps={withdrawalFlow} icon={ArrowRight} />
        </div>
      </section>

      <StorySplit
        title="Deposits and withdrawals are reviewed state machines"
        description="Nothing jumps from requested to completed. Each transition is validated server-side, and illegal jumps are refused — even for admins with the wrong role."
        video={videos.workstation}
        poster={images.analyticsLaptop}
        bullets={[
          'Deposits credit only after finance approval.',
          'Withdrawals reserve first so balances cannot be double-spent.',
          'Rejected withdrawals release reserved funds back to available.',
          'Every transition leaves a ledger and audit trail.',
        ]}
        cta={{ to: '/auth/register', label: 'Create a protected account' }}
      />

      {/* Roles matrix */}
      <section className="relative isolate overflow-hidden bg-brand py-24 text-white sm:py-32">
        <VideoBackground
          src={videos.cityNight}
          poster={images.skyscrapers}
          overlayClassName="bg-gradient-to-b from-brand via-brand/92 to-brand"
        />
        <div className="container-page relative">
          <SectionHeading
            inverted
            eyebrow="Least privilege"
            title="Admins only get the access their job needs"
            description="Roles are stored as signed identity claims and checked on the server for every privileged call."
          />
          <Reveal delay={0.1} className="mt-14 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/50">
                  <th className="sticky left-0 z-10 bg-brand px-6 py-4 font-medium">Action</th>
                  {roles.map((role) => (
                    <th key={role} className="px-4 py-4 text-center font-medium">
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {matrix.map((row, i) => (
                  <motion.tr
                    key={row.action}
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.06 }}
                    className="transition-colors hover:bg-white/[0.04]"
                  >
                    <td className="sticky left-0 z-10 max-w-40 bg-brand px-6 py-4 font-medium text-white sm:max-w-none">{row.action}</td>
                    {roles.map((role) => (
                      <td key={role} className="px-4 py-4 text-center">
                        {row.allowed.includes(role) ? (
                          <Check className="mx-auto size-5 text-accent-bright" aria-label="Allowed" />
                        ) : (
                          <Minus className="mx-auto size-4 text-white/20" aria-label="Not allowed" />
                        )}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </Reveal>
        </div>
      </section>

      {/* Audit log */}
      <section className="container-page grid grid-cols-1 items-center gap-16 py-24 sm:py-32 lg:grid-cols-2">
        <Reveal className="order-2 min-w-0 lg:order-1">
          <div className="overflow-hidden rounded-3xl border border-line bg-panel shadow-lift">
            <div className="flex items-center gap-2 border-b border-line bg-panel-elevated px-5 py-3">
              <span className="size-2.5 rounded-full bg-danger/60" />
              <span className="size-2.5 rounded-full bg-warning/60" />
              <span className="size-2.5 rounded-full bg-accent/60" />
              <span className="ml-3 text-xs text-ink-muted">auditLogs, example entry</span>
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-relaxed text-ink">
              {`{
  "action":       "deposit.approve",
  "actorId":      "admin_7f3c…",
  "resourceType": "deposit",
  "resourceId":   "dep_91a2…",
  "metadata":     { "amountMinor": 500000 },
  "createdAt":    "server timestamp"
}`}
            </pre>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">Illustrative entry. Field names match the stored schema.</p>
        </Reveal>
        <div className="order-1 min-w-0 lg:order-2">
          <SectionHeading
            align="left"
            eyebrow="Accountability"
            title="Every privileged action leaves a permanent record"
            description="Approvals, rejections, completions, and role changes each write an audit entry from the server. Clients cannot create, edit, or delete audit records — not even admins."
          />
          <Reveal delay={0.1}>
            <ParallaxImage src={images.analyticsLaptop} alt="Analyst reviewing records" className="mt-8 aspect-[16/9] rounded-3xl" />
          </Reveal>
        </div>
      </section>

      {/* Responsible disclosure */}
      <section className="container-page pb-16">
        <Reveal className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-line bg-panel p-8 shadow-card sm:flex-row sm:items-center sm:p-10">
          <div className="flex gap-5">
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-warning/10 text-warning">
              <Bug className="size-6" />
            </span>
            <div>
              <h2 className="text-2xl">Found a security issue?</h2>
              <p className="mt-1 max-w-xl text-ink-muted">
                Please report it privately through our contact page so we can investigate and fix it
                before it is disclosed publicly.
              </p>
            </div>
          </div>
          <Button asChild size="lg">
            <Link to="/contact?topic=security">
              Report a vulnerability
              <ArrowRight />
            </Link>
          </Button>
        </Reveal>
      </section>

      <section className="overflow-hidden border-y border-line bg-panel">
        <div className="container-page grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2">
          <div className="relative mx-auto">
            <WalletPhone screen="security" float />
            <div className="pointer-events-none absolute -inset-12 -z-10 rounded-full bg-accent/10 blur-3xl" />
          </div>
          <div>
            <SectionHeading
              align="left"
              eyebrow="On-device custody"
              title="Android wallet security is a different layer"
              description="Self-custody keys never touch the web ledger. VFXT Wallet encrypts phrases on device, blocks screenshots on secret screens, and requires PIN or biometrics before sensitive actions."
            />
            <Reveal delay={0.08}>
              <ul className="mt-8 space-y-3">
                {[
                  'Android Keystore–backed vault; app backup disabled.',
                  'BIP-39 create/verify and import flows.',
                  'Auto-lock intervals and Lock now.',
                  'WalletConnect signing always needs your explicit review.',
                ].map((item) => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed text-ink-muted">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="mt-10">
                <Link to="/wallet">
                  Wallet security details
                  <ArrowRight />
                </Link>
              </Button>
            </Reveal>
          </div>
        </div>
      </section>

      <CtaBand
        title="Open an account on rails you can inspect"
        description="Email verification, server-side balances, and audited admin actions — before you move a single unit."
        video={videos.floatingIndicators}
        poster={images.tradingChartDark}
      />
    </>
  )
}
