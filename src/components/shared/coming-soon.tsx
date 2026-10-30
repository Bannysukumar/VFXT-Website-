import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TypeText } from '@/components/motion/typing'

/** Feature-flagged module placeholder with imagery and a short capability preview. */
export function ComingSoon({
  icon: Icon,
  title,
  description,
  image,
  points,
}: {
  icon: LucideIcon
  title: string
  description: string
  image: string
  points: string[]
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative isolate grid overflow-hidden rounded-3xl bg-brand text-white shadow-lift lg:grid-cols-[1.1fr_1fr]"
    >
      <div className="relative z-10 p-8 sm:p-12">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-highlight">
          <span className="size-1.5 animate-pulse rounded-full bg-highlight" />
          Coming soon
        </span>
        <span className="mt-8 grid size-14 place-items-center rounded-2xl bg-accent text-white shadow-lg shadow-accent/30">
          <Icon className="size-7" />
        </span>
        <h1 className="mt-6 text-3xl font-bold text-white sm:text-4xl">
          <TypeText text={title} speed={60} delay={400} />
        </h1>
        <p className="mt-3 max-w-md text-white/70">{description}</p>
        <ul className="mt-8 space-y-3">
          {points.map((point) => (
            <li key={point} className="flex items-center gap-3 text-sm text-white/80">
              <CheckCircle2 className="size-4 shrink-0 text-accent-bright" />
              {point}
            </li>
          ))}
        </ul>
        <Button asChild variant="light" className="mt-10">
          <Link to="/app/token">
            View token roadmap
            <ArrowRight />
          </Link>
        </Button>
      </div>
      <div className="relative min-h-64">
        <img src={image} alt="" className="absolute inset-0 size-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-brand via-brand/40 to-transparent lg:via-brand/20" />
      </div>
    </motion.section>
  )
}
