import { useId } from 'react'
import { cn } from '@/lib/utils'

/** Transparent VFXT "V" mark — use on any light or dark surface. */
export function LogoMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const leftId = `vfxt-l-${uid}`
  const rightId = `vfxt-r-${uid}`

  return (
    <svg
      viewBox="33 37 42 36.5"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('size-8', className)}
    >
      <defs>
        <linearGradient
          id={leftId}
          x1="33"
          y1="37"
          x2="54"
          y2="73"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#00A6FF" />
          <stop offset="1" stopColor="#2878FF" />
        </linearGradient>
        <linearGradient
          id={rightId}
          x1="75"
          y1="37"
          x2="55"
          y2="73"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8157FF" />
          <stop offset="1" stopColor="#2878FF" />
        </linearGradient>
      </defs>
      <path
        d="M75,37 L64,37 L52.5,67 L56.5,73 Q58.5,73.5 59.5,71 Z"
        fill={`url(#${rightId})`}
      />
      <path
        d="M33,37 L44,37 L57,71 L50.5,73 Q48.5,73.5 47.5,71 Z"
        fill={`url(#${leftId})`}
      />
    </svg>
  )
}

/** App-icon style: "V" on the dark rounded tile with blue glow. */
export function LogoTile({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '')
  const glowId = `vfxt-g-${uid}`
  const leftId = `vfxt-tl-${uid}`
  const rightId = `vfxt-tr-${uid}`

  return (
    <svg
      viewBox="0 0 108 108"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={cn('size-8', className)}
    >
      <defs>
        <radialGradient
          id={glowId}
          cx="54"
          cy="50"
          r="48"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#2878FF" stopOpacity="0.33" />
          <stop offset="1" stopColor="#080D19" stopOpacity="0" />
        </radialGradient>
        <linearGradient
          id={leftId}
          x1="33"
          y1="37"
          x2="54"
          y2="73"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#00A6FF" />
          <stop offset="1" stopColor="#2878FF" />
        </linearGradient>
        <linearGradient
          id={rightId}
          x1="75"
          y1="37"
          x2="55"
          y2="73"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#8157FF" />
          <stop offset="1" stopColor="#2878FF" />
        </linearGradient>
      </defs>
      <rect width="108" height="108" rx="24" fill="#080D19" />
      <rect width="108" height="108" rx="24" fill={`url(#${glowId})`} />
      <path
        d="M75,37 L64,37 L52.5,67 L56.5,73 Q58.5,73.5 59.5,71 Z"
        fill={`url(#${rightId})`}
      />
      <path
        d="M33,37 L44,37 L57,71 L50.5,73 Q48.5,73.5 47.5,71 Z"
        fill={`url(#${leftId})`}
      />
    </svg>
  )
}

export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={cn(
          'font-display text-lg font-bold tracking-tight',
          inverted ? 'text-white' : 'text-ink',
        )}
      >
        VFXT
      </span>
    </span>
  )
}
