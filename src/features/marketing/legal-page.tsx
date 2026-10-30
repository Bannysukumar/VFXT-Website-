import { useEffect, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { motion, useScroll, useSpring } from 'framer-motion'
import { AlertTriangle, CalendarDays, FileText, Printer, Scale, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CountUp, Reveal } from '@/components/motion/reveal'
import { MarketingHero } from '@/features/marketing/marketing-hero'
import { LEGAL_ENTITY, legalDocs, type LegalDoc } from '@/features/marketing/legal-content'
import { images, videos } from '@/lib/media'
import { cn } from '@/lib/utils'

const docTabs = [
  { to: '/legal/terms', label: 'Terms of Service', icon: FileText },
  { to: '/legal/privacy', label: 'Privacy Policy', icon: Scale },
  { to: '/legal/risk', label: 'Risk Disclosure', icon: ShieldAlert },
]

const heroMedia: Record<LegalDoc['slug'], { poster: string; video?: string }> = {
  terms: { poster: images.handshake },
  privacy: { poster: images.phoneAndLaptop },
  risk: { poster: images.candlesticks, video: videos.marketCloseUp },
}

function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0])
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-96px 0px -60% 0px' },
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [ids])
  return active
}

function LegalPage({ doc }: { doc: LegalDoc }) {
  const ids = doc.sections.map((s) => s.id)
  const active = useActiveSection(ids)
  const { scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 })
  const media = heroMedia[doc.slug]

  return (
    <>
      <motion.div
        className="fixed inset-x-0 top-0 z-50 h-1 origin-left bg-gradient-to-r from-accent to-accent-bright"
        style={{ scaleX: progress }}
      />
      <MarketingHero
        eyebrow={doc.eyebrow}
        title={doc.title}
        description={doc.summary}
        poster={media.poster}
        video={media.video}
      >
        <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/60">
          <span className="inline-flex items-center gap-2">
            <CalendarDays className="size-4" />
            Last updated {LEGAL_ENTITY.updated}
          </span>
          <span className="hidden size-1 rounded-full bg-white/30 sm:block" />
          <span>
            <CountUp value={doc.sections.length} duration={1} /> sections
          </span>
        </div>
      </MarketingHero>

      {/* Document switcher */}
      <div className="sticky top-16 z-30 border-b border-line bg-panel/85 backdrop-blur-lg">
        <div className="container-page flex gap-1 overflow-x-auto py-2">
          {docTabs.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-brand text-white' : 'text-ink-muted hover:bg-panel-elevated hover:text-ink',
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      <section className="container-page grid gap-12 py-16 lg:grid-cols-[240px_1fr] lg:py-20">
        {/* Table of contents */}
        <aside className="hidden lg:block">
          <nav className="sticky top-36 space-y-1" aria-label="On this page">
            <p className="mb-3 text-xs font-semiboldr text-ink-subtle">On this page</p>
            {doc.sections.map((section, i) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={cn(
                  'relative flex gap-3 rounded-lg py-1.5 pl-4 pr-2 text-sm transition-colors',
                  active === section.id ? 'font-medium text-ink' : 'text-ink-muted hover:text-ink',
                )}
              >
                {active === section.id ? (
                  <motion.span layoutId="toc-indicator" className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-accent" />
                ) : null}
                <span className="tabular text-ink-subtle">{String(i + 1).padStart(2, '0')}</span>
                {section.heading}
              </a>
            ))}
            <Button variant="outline" size="sm" className="mt-6" onClick={() => window.print()}>
              <Printer />
              Print / save PDF
            </Button>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          {doc.keyPoints ? (
            <Reveal className="mb-14 overflow-hidden rounded-3xl border-2 border-warning/40 bg-warning/5">
              <div className="flex items-center gap-3 border-b border-warning/25 bg-warning/10 px-6 py-4">
                <AlertTriangle className="size-5 text-warning" />
                <p className="font-display text-lg font-bold">Key risks at a glance</p>
              </div>
              <ul className="space-y-3 p-6">
                {doc.keyPoints.map((point, i) => (
                  <motion.li
                    key={point}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 + i * 0.07 }}
                    className="flex gap-3 text-[15px] font-medium leading-relaxed"
                  >
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-warning" />
                    {point}
                  </motion.li>
                ))}
              </ul>
            </Reveal>
          ) : null}

          <div className="space-y-12">
            {doc.sections.map((section, i) => (
              <Reveal key={section.id} y={12}>
                <section id={section.id} className="scroll-mt-36">
                  <h2 className="flex items-baseline gap-3 text-2xl">
                    <span className="tabular font-display text-base font-bold text-accent">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    {section.heading}
                  </h2>
                  <div className="mt-4 max-w-[68ch] space-y-4 text-[15px] leading-relaxed text-ink-muted">
                    {section.paragraphs?.map((p) => <p key={p}>{p}</p>)}
                    {section.bullets ? (
                      <ul className="space-y-2.5">
                        {section.bullets.map((b) => (
                          <li key={b} className="flex gap-3">
                            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                </section>
              </Reveal>
            ))}
          </div>

          <div className="mt-16 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-panel p-6 shadow-card sm:flex-row sm:items-center">
            <div>
              <p className="font-semibold">Questions about this document?</p>
              <p className="text-sm text-ink-muted">Our team will help you understand it.</p>
            </div>
            <Button asChild>
              <Link to="/contact?topic=legal">Contact us</Link>
            </Button>
          </div>
        </article>
      </section>
    </>
  )
}

export function TermsPage() {
  return <LegalPage doc={legalDocs.terms} />
}

export function PrivacyPage() {
  return <LegalPage doc={legalDocs.privacy} />
}

export function RiskDisclosurePage() {
  return <LegalPage doc={legalDocs.risk} />
}
