import { useEffect, useRef, useState } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

function Cursor({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'ml-0.5 inline-block h-[0.9em] w-[3px] translate-y-[0.1em] animate-pulse rounded-full bg-accent-bright align-baseline',
        className,
      )}
    />
  )
}

/**
 * Types `text` out once. The full text is rendered invisibly underneath so the layout never
 * shifts, and screen readers always get the complete string.
 */
export function TypeText({
  text,
  speed = 32,
  delay = 150,
  startOnView = false,
  cursor = true,
  className,
  cursorClassName,
}: {
  text: string
  speed?: number
  delay?: number
  startOnView?: boolean
  cursor?: boolean
  className?: string
  cursorClassName?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduceMotion = useReducedMotion()
  const [count, setCount] = useState(reduceMotion ? text.length : 0)
  const done = count >= text.length

  useEffect(() => {
    if (reduceMotion) {
      setCount(text.length)
      return
    }
    if (startOnView && !inView) return
    setCount(0)
    let i = 0
    let timer: ReturnType<typeof setTimeout>
    const tick = () => {
      i += 1
      setCount(i)
      if (i < text.length) timer = setTimeout(tick, speed)
    }
    timer = setTimeout(tick, delay)
    return () => clearTimeout(timer)
  }, [text, speed, delay, startOnView, inView, reduceMotion])

  return (
    <span ref={ref} className={cn('relative inline-grid', className)}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {text}
      </span>
      <span aria-hidden className="col-start-1 row-start-1">
        {text.slice(0, count)}
        {cursor && !done ? <Cursor className={cursorClassName} /> : null}
      </span>
    </span>
  )
}

/** Types a word, pauses, deletes it, and moves to the next — in a loop. */
export function RotatingWords({
  words,
  className,
  typeSpeed = 70,
  deleteSpeed = 40,
  pause = 1800,
}: {
  words: string[]
  className?: string
  typeSpeed?: number
  deleteSpeed?: number
  pause?: number
}) {
  const reduceMotion = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [length, setLength] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const word = words[index % words.length] ?? ''
  const longest = words.reduce((a, b) => (b.length > a.length ? b : a), '')

  useEffect(() => {
    if (reduceMotion) return
    let timer: ReturnType<typeof setTimeout>
    if (!deleting && length < word.length) {
      timer = setTimeout(() => setLength(length + 1), typeSpeed)
    } else if (!deleting && length === word.length) {
      timer = setTimeout(() => setDeleting(true), pause)
    } else if (deleting && length > 0) {
      timer = setTimeout(() => setLength(length - 1), deleteSpeed)
    } else {
      setDeleting(false)
      setIndex((i) => (i + 1) % words.length)
    }
    return () => clearTimeout(timer)
  }, [length, deleting, word, words.length, typeSpeed, deleteSpeed, pause, reduceMotion])

  const visible = reduceMotion ? (words[0] ?? '') : word.slice(0, length)

  return (
    <span className="relative inline-grid text-left align-bottom">
      <span className="sr-only">{words[0]}</span>
      <span aria-hidden className="invisible col-start-1 row-start-1 whitespace-nowrap">
        {longest}
      </span>
      <span aria-hidden className="col-start-1 row-start-1 whitespace-nowrap">
        <span className={className}>{visible || ' '}</span>
        {reduceMotion ? null : <Cursor />}
      </span>
    </span>
  )
}

/** Reveals a heading word by word when it scrolls into view. */
export function WordReveal({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const reduceMotion = useReducedMotion()
  const show = inView || Boolean(reduceMotion)
  const words = text.split(' ')

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {words.map((word, i) => (
          <span key={`${word}-${i}`}>
            <span className="inline-block overflow-hidden pb-[0.08em] align-top">
              <motion.span
                className="inline-block"
                initial={false}
                animate={show ? { y: '0%', opacity: 1 } : { y: '100%', opacity: 0 }}
                transition={{ duration: 0.55, delay: show && !reduceMotion ? i * 0.06 : 0, ease: [0.22, 1, 0.36, 1] }}
              >
                {word}
              </motion.span>
            </span>
            {i < words.length - 1 ? ' ' : null}
          </span>
        ))}
      </span>
    </span>
  )
}
