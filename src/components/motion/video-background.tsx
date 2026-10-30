import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * Full-bleed looping background video. Shows the poster image first, fades the video in
 * once it can play, and stays on the poster for reduced-motion users or if the video fails.
 */
export function VideoBackground({
  src,
  poster,
  className,
  overlayClassName = 'bg-gradient-to-b from-brand/80 via-brand/70 to-brand',
}: {
  src: string
  poster: string
  className?: string
  overlayClassName?: string
}) {
  const reduceMotion = useReducedMotion()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    // Pause off-screen videos to save bandwidth and battery.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) void video.play().catch(() => undefined)
      else video.pause()
    })
    observer.observe(video)
    return () => observer.disconnect()
  }, [reduceMotion, failed])

  return (
    <div className={cn('absolute inset-0 overflow-hidden', className)} aria-hidden>
      <img
        src={poster}
        alt=""
        className="absolute inset-0 size-full scale-105 object-cover"
        loading="eager"
      />
      {!reduceMotion && !failed ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          onCanPlay={() => setReady(true)}
          onError={() => setFailed(true)}
          className={cn(
            'absolute inset-0 size-full object-cover transition-opacity duration-1000',
            ready ? 'opacity-100' : 'opacity-0',
          )}
        />
      ) : null}
      <div className={cn('absolute inset-0', overlayClassName)} />
      <div className="noise absolute inset-0 opacity-[0.06] mix-blend-overlay" />
    </div>
  )
}
