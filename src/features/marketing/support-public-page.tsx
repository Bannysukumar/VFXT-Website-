import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  KeyRound,
  LifeBuoy,
  MessageSquareText,
  ShieldCheck,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ParallaxImage, Reveal } from '@/components/motion/reveal'
import {
  CinematicBand,
  CtaBand,
  Faq,
  MarketingHero,
  SectionHeading,
  StatsBand,
  StorySplit,
} from '@/features/marketing/marketing-hero'
import { commonFaqs, miningFaqs, walletFaqs } from '@/features/marketing/content'
import { PhonePair, PhoneTrio } from '@/features/marketing/phone-mockup'
import { images, videos } from '@/lib/media'

const options = [
  {
    icon: MessageSquareText,
    title: 'Open a ticket',
    body: 'Signed-in users can create and track support tickets right from the dashboard.',
    to: '/app/support',
    cta: 'Go to support',
    image: images.supportDesk,
  },
  {
    icon: KeyRound,
    title: 'Recover your account',
    body: 'Forgot your password? Request a secure reset link by email in seconds.',
    to: '/auth/reset',
    cta: 'Reset password',
    image: images.phoneAndLaptop,
  },
  {
    icon: UserPlus,
    title: 'New to VFXT?',
    body: 'Create an account to access wallets, deposits, withdrawals, and support.',
    to: '/auth/register',
    cta: 'Create account',
    image: images.teamLaptops,
  },
]

const topics = [
  'Deposit status and references',
  'Daily income / stake timing',
  'Transfers between wallets or members',
  'Withdrawal address updates',
  'Login and password recovery',
  'Android wallet install help',
  'Mining sessions and claims',
  'Lost recovery phrase (we cannot restore keys)',
]

const helpGuides = [
  { to: '/wallet', title: 'Wallet guide', body: 'Self-custody features, networks, swaps, and device security.' },
  { to: '/mining', title: 'Mining guide', body: 'Sessions, rewards, boosters, and how mining differs from stakes.' },
  { to: '/download', title: 'Official APK', body: 'Download only from this site. Never trust sideloaded copies.' },
  { to: '/security', title: 'Security model', body: 'How the web ledger stays server-authoritative.' },
]

export function SupportPublicPage() {
  return (
    <>
      <MarketingHero
        eyebrow="Support centre"
        title="How can we help you today?"
        description="Find the fastest route to an answer — tickets for account issues, password reset for access, and FAQs covering deposits, stakes, transfers, withdrawals, and the Android wallet."
        video={videos.deskActivity}
        poster={images.workingLaptop}
        aside={<PhonePair front="home" back="mining" />}
      >
        <div className="mt-10 flex flex-wrap gap-3">
          <Button size="lg" variant="accent" asChild>
            <Link to="/app/support">
              <LifeBuoy />
              Open a ticket
            </Link>
          </Button>
          <Button size="lg" variant="glass" asChild>
            <a href="#faq">Browse FAQs</a>
          </Button>
        </div>
      </MarketingHero>

      <section className="container-page -mt-12 relative z-10 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {options.map(({ icon: Icon, title, body, to, cta, image }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <Link
                to={to}
                className="group flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-panel shadow-lift transition-[transform,background-color,border-color,color] duration-300 hover:-translate-y-1.5 hover:border-accent/40"
              >
                <div className="relative h-40 overflow-hidden">
                  <img src={image} alt="" loading="lazy" className="size-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-brand/70 to-transparent" />
                  <span className="absolute bottom-4 left-5 grid size-11 place-items-center rounded-xl bg-panel text-accent shadow-lift">
                    <Icon className="size-5" />
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h2 className="text-lg">{title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    {cta}
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <StatsBand
        className="border-t"
        items={[
          { value: options.length, label: 'Ways to get help' },
          { value: 4, label: 'Ticket statuses you can track' },
          { value: commonFaqs.length, label: 'Answered FAQs' },
          { value: 24, suffix: '/7', label: 'Ticket submission' },
        ]}
      />

      <CinematicBand
        title="Account help without leaving VFXT"
        description="Support tickets live inside your signed-in dashboard so we can see the right context — without asking you to paste passwords or private keys into email."
        video={videos.cityNight}
        poster={images.supportDesk}
        points={[
          'Open → In progress → Resolved',
          'Dedicated support admins',
          'Never share passwords or seeds',
          'Contact form for general topics',
        ]}
        cta={{ to: '/contact', label: 'Contact the team' }}
      />

      <section className="border-b border-line bg-panel">
        <div className="container-page grid items-center gap-16 py-24 lg:grid-cols-2">
          <Reveal>
            <ParallaxImage src={images.supportDesk} alt="Support specialist at work" className="aspect-[4/3] rounded-3xl shadow-lift" />
          </Reveal>
          <div>
            <SectionHeading
              align="left"
              eyebrow="Ticket workflow"
              title="Ticket workflow"
              description="Tickets are routed to dedicated support admins. You can follow each one from open to resolved inside your dashboard."
            />
            <Reveal delay={0.1} className="mt-8 grid gap-4 sm:grid-cols-3">
              {[
                { icon: MessageSquareText, title: 'Open', body: 'Describe the issue' },
                { icon: Clock, title: 'In progress', body: 'An admin picks it up' },
                { icon: ShieldCheck, title: 'Resolved', body: 'Closed with an answer' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-2xl border border-line bg-canvas p-5">
                  <Icon className="size-5 text-accent" />
                  <p className="mt-4 font-semibold">{title}</p>
                  <p className="text-sm text-ink-muted">{body}</p>
                </div>
              ))}
            </Reveal>
          </div>
        </div>
      </section>

      <StorySplit
        reverse
        title="Common topics we help with"
        description="Most questions fall into a few clear buckets. Start with the FAQ — if you need a human, open a ticket with your User ID and what you already tried."
        video={videos.workstation}
        poster={images.workingLaptop}
        bullets={topics}
        cta={{ to: '/app/support', label: 'Open a ticket' }}
      />

      <section className="border-y border-line bg-panel py-16">
        <div className="container-page">
          <PhoneTrio screens={['security', 'receive', 'assets']} />
        </div>
      </section>

      <section className="container-page py-20">
        <SectionHeading
          eyebrow="Guides"
          title="Browse product guides before you open a ticket"
          description="Many questions are already answered on the public pages for the Android wallet and mining tab."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {helpGuides.map(({ to, title, body }, i) => (
            <Reveal key={to} delay={i * 0.05}>
              <Link
                to={to}
                className="flex h-full flex-col rounded-3xl border border-line bg-panel p-6 transition-[transform,border-color] duration-300 hover:-translate-y-1 hover:border-accent/40"
              >
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 flex-1 text-sm text-ink-muted">{body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
                  Open
                  <ArrowRight className="size-4" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="faq" className="container-page scroll-mt-20 py-24">
        <SectionHeading eyebrow="FAQ" title="Platform, wallet, and mining questions" />
        <div className="mx-auto mt-12 grid max-w-5xl gap-10 lg:grid-cols-1">
          <Reveal delay={0.05}>
            <p className="mb-4 text-sm font-semibold text-ink">Platform</p>
            <Faq items={commonFaqs} />
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mb-4 text-sm font-semibold text-ink">VFXT Wallet</p>
            <Faq items={walletFaqs} />
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mb-4 text-sm font-semibold text-ink">Mining</p>
            <Faq items={miningFaqs} />
          </Reveal>
        </div>
      </section>

      <CtaBand
        title="Still stuck? We are one ticket away"
        description="Create or sign in to your account, open Support, and describe what you need — we will take it from there."
        video={videos.skylinePan}
        poster={images.officeTalk}
      />
    </>
  )
}
