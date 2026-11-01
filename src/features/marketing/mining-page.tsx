import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BatteryCharging,
  Clock,
  Coins,
  Download,
  Gauge,
  History,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Reveal } from '@/components/motion/reveal'
import {
  CinematicBand,
  CtaBand,
  Faq,
  MarketingHero,
  SectionHeading,
  StatsBand,
  StorySplit,
} from '@/features/marketing/marketing-hero'
import { miningFaqs } from '@/features/marketing/content'
import { PhonePair, PhoneShowcaseBand, WalletPhone } from '@/features/marketing/phone-mockup'
import { TokenFactsStrip } from '@/features/marketing/token-facts'
import { images, videos } from '@/lib/media'
import { VFXT_TOKEN } from '@/lib/vfxt-token'

const pillars = [
  {
    icon: Clock,
    title: 'Daily mining sessions',
    body: 'Start a timed session from the Mining tab. Progress, countdown, and live estimates update while the session runs. Stop is only available when the server allows it.',
  },
  {
    icon: Coins,
    title: 'Claim VFXT rewards',
    body: 'Track available, lifetime, and claimed rewards. Claim VFXT to your wallet once you clear the minimum threshold set by the programme.',
  },
  {
    icon: Gauge,
    title: 'Speed boosters',
    body: 'Browse the booster catalog and pay with USDT (BEP-20) signed only from the in-app wallet — never by typing a private key into a form.',
  },
  {
    icon: History,
    title: 'Session history',
    body: 'Review past mining sessions so you can reconcile what ran, what earned, and what you already claimed.',
  },
]

const rules = [
  'Rates, session length, and caps are server-authoritative — the phone displays what the backend decides.',
  'A rules sheet in the app explains the formula and payout policy for the current configuration.',
  'Mining sign-in uses a wallet signature to obtain a VFXT account session (Firebase custom token).',
  'Push notifications can alert you about mining and claim events when enabled.',
]

const compare = [
  {
    title: 'Android mining',
    body: 'On-device wallet sessions that accrue VFXT you claim to your self-custody address.',
    points: ['Mining tab in VFXT Wallet', 'USDT-paid boosters', 'Wallet-signature login'],
  },
  {
    title: 'Web daily income stakes',
    body: 'Platform ledger stakes from your Deposit wallet that credit Daily ROI on a per-stake 24-hour clock.',
    points: ['Reviewed USDT deposits first', '~1% per 24h per stake', 'Caps enforced server-side'],
  },
]

export function MiningPage() {
  return (
    <>
      <MarketingHero
        eyebrow="VFXT Mining"
        title="Mine VFXT from the Android wallet"
        description="The Mining tab in VFXT Wallet runs timed daily sessions, tracks rewards, and lets you claim VFXT to your self-custody address — with optional USDT speed boosters."
        video={videos.dataPulse}
        poster={images.blockchain}
        aside={<PhonePair front="mining" back="home" />}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" variant="accent" asChild>
            <Link to="/download">
              Download the wallet
              <Download />
            </Link>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <Link to="/wallet">Wallet features</Link>
          </Button>
        </div>
      </MarketingHero>

      <StatsBand
        items={[
          { value: 1, label: 'Dedicated Mining tab' },
          { value: 24, suffix: 'h', label: 'Daily session rhythm' },
          { value: 0, label: 'Private keys typed into forms' },
          { value: 1, label: 'Wallet-signature account login' },
        ]}
      />

      <PhoneShowcaseBand
        title="Mining on a screen you can actually use"
        description="Session progress, available rewards, boosters, and claim — laid out for one-handed Android use."
        screens={['mining', 'home', 'assets']}
      />

      <section className="container-page py-16 sm:py-20">
        <SectionHeading
          eyebrow="Claim asset"
          title={`Rewards settle as ${VFXT_TOKEN.symbol}`}
          description={`${VFXT_TOKEN.name} / ${VFXT_TOKEN.symbol} — fixed ${VFXT_TOKEN.supplyShort} supply on ${VFXT_TOKEN.networkLabel}.`}
          className="mb-10"
        />
        <Reveal>
          <TokenFactsStrip />
        </Reveal>
      </section>

      <section className="container-page py-24 sm:py-32">
        <div className="grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="relative mx-auto hidden lg:block">
            <WalletPhone screen="mining" float />
            <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-accent/15 blur-3xl" />
          </Reveal>
          <div>
            <SectionHeading
              align="left"
              eyebrow="How mining works"
              title="Sessions, rewards, boosters, history"
              description="Everything in the Mining tab is designed around a clear loop: start a session, watch progress, claim when ready, and optionally boost speed with USDT from the same wallet."
            />
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {pillars.map(({ icon: Icon, title, body }, i) => (
                <Reveal
                  key={title}
                  delay={i * 0.06}
                  className="rounded-3xl border border-line bg-panel p-6 shadow-card"
                >
                  <span className="grid size-10 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/20">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <CinematicBand
        title="Server rules. Phone display."
        description="The wallet never invents mining rates. Session length, rewards, and caps come from VFXT backends so every member sees the same programme rules."
        video={videos.analystRealtime}
        poster={images.candlesticks}
        points={rules}
      />

      <StorySplit
        title="Boosters paid from your in-app wallet"
        description="Speed boosters sit in a catalog inside Mining. When you buy one, the payment is a USDT BEP-20 transfer you sign with the active wallet — the same security model as Send and Swap."
        video={videos.marketCloseUp}
        poster={images.coins}
        bullets={[
          'Browse boosters before you commit.',
          'Pay with USDT on BNB Smart Chain.',
          'Sign only after reviewing the amount.',
          'Never share your recovery phrase to “activate” a booster.',
        ]}
        cta={{ to: '/wallet', label: 'See wallet security' }}
      />

      <section className="border-y border-line bg-panel">
        <div className="container-page py-24 sm:py-32">
          <SectionHeading
            eyebrow="Two products, clear jobs"
            title="Mining is not the same as web daily stakes"
            description="Members often ask which product to use. Both are part of VFXT — they settle differently and live in different apps."
          />
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {compare.map(({ title, body, points }, i) => (
              <Reveal
                key={title}
                delay={i * 0.08}
                className="rounded-3xl border border-line bg-canvas p-8"
              >
                <p className="text-xs font-semibold text-accent">{title}</p>
                <h3 className="mt-3 text-2xl font-semibold">{title === 'Android mining' ? 'Mine in the wallet' : 'Stake on the web'}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ink-muted">{body}</p>
                <ul className="mt-6 space-y-2">
                  {points.map((p) => (
                    <li key={p} className="flex gap-2 text-sm text-ink">
                      <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
                      {p}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-8" variant={i === 0 ? 'default' : 'outline'}>
                  <Link to={i === 0 ? '/download' : '/auth/register'}>
                    {i === 0 ? 'Get the Android wallet' : 'Open a platform account'}
                    <ArrowRight />
                  </Link>
                </Button>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <StorySplit
        reverse
        title="Stay notified without giving up custody"
        description="Enable mining and claim notifications so you know when a session matters. Alerts land on your phone; claiming still requires you, inside the wallet you control."
        video={videos.deskActivity}
        poster={images.phoneAndLaptop}
        bullets={[
          'In-app notification inbox for mining and security events.',
          'Optional push via Firebase Cloud Messaging.',
          'Active sessions and account sign-out live under Profile.',
          'Support FAQs cover restore, mining payouts, and demo trade.',
        ]}
        cta={{ to: '/support', label: 'Visit support' }}
      />

      <section className="container-page grid gap-12 py-24 sm:py-32 lg:grid-cols-[1fr_1.35fr]">
        <div>
          <SectionHeading
            align="left"
            eyebrow="Mining FAQ"
            title="Before you start a session"
            description="Honest answers from how the Android Mining tab is built — including what is demo and what is live."
          />
          <Reveal delay={0.08} className="mt-8 space-y-3">
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-panel p-4 text-sm text-ink-muted">
              <BatteryCharging className="mt-0.5 size-5 shrink-0 text-accent" />
              Keep the app installed and your wallet backed up. Uninstalling without a recovery phrase means permanent loss of on-chain access.
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-panel p-4 text-sm text-ink-muted">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-accent" />
              The Trade tab is a demo preview only and does not execute real orders against your wallet.
            </div>
          </Reveal>
        </div>
        <Reveal delay={0.1}>
          <Faq items={miningFaqs} />
        </Reveal>
      </section>

      <section className="container-page pb-10">
        <Reveal className="flex flex-col items-start justify-between gap-6 rounded-3xl border border-line bg-panel p-8 sm:flex-row sm:items-center sm:p-10">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Wallet className="size-6" />
            </span>
            <div>
              <h2 className="text-xl font-semibold">Need the wallet first?</h2>
              <p className="mt-1 max-w-xl text-sm text-ink-muted">
                Mining lives inside VFXT Wallet. Install the official APK, create or import a wallet, then open the Mining tab.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/download">
                Download
                <Download />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/wallet">Wallet overview</Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <CtaBand
        title="Start mining from a wallet you control"
        description="Download VFXT Wallet, secure your phrase, and open the Mining tab when you are ready to run a session."
        video={videos.floatingIndicators}
        poster={images.tradingChartDark}
      />
    </>
  )
}
