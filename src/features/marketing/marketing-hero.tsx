import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { VideoBackground } from '@/components/motion/video-background'
import { CountUp, Reveal } from '@/components/motion/reveal'
import { cn } from '@/lib/utils'
import { RotatingWords, TypeText, WordReveal } from '@/components/motion/typing'

const ease = [0.22, 1, 0.36, 1] as const

/** Dark, full-bleed page hero with a looping video (or still image) behind it. */
export function MarketingHero({
  eyebrow,
  title,
  description,
  video,
  poster,
  children,
  aside,
  rotate,
}: {
  eyebrow: string
  title: ReactNode
  /** Words typed and cycled in a gradient after the title. */
  rotate?: string[]
  description: ReactNode
  video?: string
  poster: string
  children?: ReactNode
  aside?: ReactNode
}) {
  return (
    <section className="relative isolate overflow-hidden bg-brand text-white">
      {video ? (
        <VideoBackground src={video} poster={poster} />
      ) : (
        <div className="absolute inset-0" aria-hidden>
          <img src={poster} alt="" className="size-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand via-brand/90 to-brand/75" />
        </div>
      )}
      <div className="bg-grid absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div
        className={cn(
          'container-page relative grid items-center gap-12 pb-20 pt-36 sm:pb-24 sm:pt-40',
          aside && 'lg:grid-cols-[1.2fr_1fr]',
        )}
      >
        <div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent-bright backdrop-blur"
          >
            <span className="size-1.5 rounded-full bg-accent-bright" />
            {eyebrow}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05, ease }}
            className="mt-5 max-w-3xl text-4xl font-bold leading-[1.08] text-balance text-white sm:text-5xl lg:text-6xl"
          >
            {typeof title === 'string' && !rotate ? <TypeText text={title} speed={38} delay={350} /> : title}
            {rotate ? (
              <>
                {' '}
                <RotatingWords words={rotate} className="text-gradient" />
              </>
            ) : null}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease }}
            className="mt-6 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg"
          >
            {description}
          </motion.p>
          {children ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25, ease }}
            >
              {children}
            </motion.div>
          ) : null}
        </div>
        {aside ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease }}
          >
            {aside}
          </motion.div>
        ) : null}
      </div>
    </section>
  )
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'center',
  className,
  inverted = false,
}: {
  eyebrow: string
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'left'
  className?: string
  inverted?: boolean
}) {
  return (
    <Reveal
      className={cn(align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}
    >
      <p
        className={cn(
          'text-sm font-semibold uppercase tracking-wider',
          inverted ? 'text-accent-bright' : 'text-accent',
        )}
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          'mt-3 text-3xl font-bold text-balance sm:text-4xl lg:text-[44px] lg:leading-[1.1]',
          inverted && 'text-white',
        )}
      >
        {typeof title === 'string' ? <WordReveal text={title} /> : title}
      </h2>
      {description ? (
        <p className={cn('mt-4 text-base leading-relaxed', inverted ? 'text-white/65' : 'text-ink-muted')}>
          {description}
        </p>
      ) : null}
    </Reveal>
  )
}

export function CtaBand({
  title,
  description,
  video,
  poster,
}: {
  title: string
  description: string
  video: string
  poster: string
}) {
  return (
    <section className="container-page pb-24">
      <Reveal className="relative isolate overflow-hidden rounded-3xl px-8 py-20 text-center text-white sm:px-16">
        <VideoBackground
          src={video}
          poster={poster}
          overlayClassName="bg-gradient-to-br from-brand/95 via-brand/80 to-accent-strong/70"
        />
        <div className="relative">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold text-balance text-white sm:text-5xl">
            <WordReveal text={title} />
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-white/75">{description}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="accent" asChild>
              <Link to="/auth/register">
                Open free account
                <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="glass" asChild>
              <Link to="/auth/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-card">
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div key={item.q}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold transition-colors hover:bg-panel-elevated/50"
            >
              {item.q}
              <span
                className={cn(
                  'grid size-7 shrink-0 place-items-center rounded-full transition-all duration-300',
                  isOpen ? 'rotate-45 bg-accent text-white' : 'bg-panel-elevated text-ink-muted',
                )}
              >
                <Plus className="size-4" />
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-5 text-sm leading-relaxed text-ink-muted">{item.a}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

/** A row of animated counters. Values should be real, verifiable facts about the platform. */
export function StatsBand({
  items,
  className,
}: {
  items: { value: number; label: string; prefix?: string; suffix?: string }[]
  className?: string
}) {
  return (
    <section className={cn('border-b border-line bg-panel', className)}>
      <div className="container-page grid grid-cols-2 gap-y-8 py-12 lg:grid-cols-4 lg:divide-x lg:divide-line">
        {items.map((item, i) => (
          <Reveal key={item.label} delay={i * 0.08} className="px-4 text-center">
            <p className="font-display text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">
              <CountUp value={item.value} prefix={item.prefix} suffix={item.suffix} />
            </p>
            <p className="mt-2 text-sm text-ink-muted">{item.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
