import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  animate,
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type HTMLMotionProps,
} from 'framer-motion'
import { cn } from '@/lib/utils'

const ease = [0.22, 1, 0.36, 1] as const

/** Fades and lifts children into view once, when scrolled into the viewport. */
export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
  ...props
}: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, delay, ease }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
}

/** Image that drifts slightly slower than the page for a parallax effect. */
export function ParallaxImage({
  src,
  alt,
  className,
  imgClassName,
  strength = 40,
}: {
  src: string
  alt: string
  className?: string
  imgClassName?: string
  strength?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const reduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-strength, strength])

  return (
    <div ref={ref} className={cn('relative overflow-hidden', className)}>
      <motion.img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ y }}
        className={cn('absolute inset-0 h-[calc(100%+80px)] w-full -translate-y-10 object-cover', imgClassName)}
      />
    </div>
  )
}

/**
 * Counts up from zero to `value` when it scrolls into view. Pass `format` to render money or
 * other units; the animated value is always rounded to an integer before formatting.
 */
export function CountUp({
  value,
  suffix = '',
  prefix = '',
  duration = 1.6,
  format,
}: {
  value: number
  suffix?: string
  prefix?: string
  duration?: number
  format?: (n: number) => string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduceMotion = useReducedMotion()
  const [display, setDisplay] = useState(reduceMotion ? value : 0)

  useEffect(() => {
    if (reduceMotion) {
      setDisplay(value)
      return
    }
    if (!inView) return
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    })
    return () => controls.stop()
  }, [inView, value, duration, reduceMotion])

  return (
    <span ref={ref} className="tabular">
      {prefix}
      {format ? format(display) : display.toLocaleString()}
      {suffix}
    </span>
  )
}

/** Infinite horizontal marquee. Children are rendered twice for a seamless loop. */
export function Marquee({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'group flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]',
        className,
      )}
    >
      {[0, 1].map((copy) => (
        <div
          key={copy}
          aria-hidden={copy === 1}
          className="flex shrink-0 animate-marquee items-center gap-12 pr-12 group-hover:[animation-play-state:paused]"
        >
          {children}
        </div>
      ))}
    </div>
  )
}
