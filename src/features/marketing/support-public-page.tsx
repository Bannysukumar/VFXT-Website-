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
import { Faq, MarketingHero, SectionHeading, StatsBand } from '@/features/marketing/marketing-hero'
import { commonFaqs } from '@/features/marketing/content'
import { images } from '@/lib/media'

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

export function SupportPublicPage() {
  return (
    <>
      <MarketingHero
        eyebrow="Support centre"
        title="How can we help you today?"
        description="Find the fastest route to an answer, or reach our support team directly from your dashboard."
        poster={images.workingLaptop}
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

      <section id="faq" className="container-page scroll-mt-20 py-24">
        <SectionHeading eyebrow="FAQ" title="Frequently asked questions" />
        <Reveal delay={0.1} className="mx-auto mt-12 max-w-3xl">
          <Faq items={commonFaqs} />
        </Reveal>
      </section>
    </>
  )
}
