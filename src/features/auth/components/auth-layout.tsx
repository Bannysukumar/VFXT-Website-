import { forwardRef, useState, type ComponentProps, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Logo } from '@/components/shared/logo'
import { VideoBackground } from '@/components/motion/video-background'
import { images, videos } from '@/lib/media'
import { TypeText } from '@/components/motion/typing'

const highlights = [
  'Wallets provisioned automatically on sign-up',
  'Every deposit and withdrawal reviewed by finance admins',
  'Full ledger history with immutable audit logs',
]

const ease = [0.22, 1, 0.36, 1] as const

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description: string
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="container-page flex min-h-[calc(100dvh-4rem)] items-center justify-center py-10 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease }}
        className="grid w-full max-w-6xl overflow-hidden rounded-3xl border border-line bg-panel shadow-lift lg:min-h-[640px] lg:grid-cols-[1.05fr_1fr]"
      >
        <aside className="relative isolate hidden flex-col justify-between overflow-hidden p-10 text-white lg:flex xl:p-12">
          <VideoBackground
            src={videos.forexBoard}
            poster={images.tradingChartDark}
            overlayClassName="bg-gradient-to-br from-brand/95 via-brand/85 to-accent-strong/60"
          />
          <div className="relative">
            <Logo inverted />
          </div>
          <div className="relative">
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6, ease }}
              className="text-4xl font-bold leading-tight text-white"
            >
              Secure wallets.
              <br />
              <span className="text-gradient">Verified settlement.</span>
            </motion.h2>
            <ul className="mt-8 space-y-4">
              {highlights.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.1, duration: 0.5, ease }}
                  className="flex gap-3 text-sm text-white/80"
                >
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent-bright" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </div>
          <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/30 text-accent-bright">
              <ShieldCheck className="size-5" />
            </span>
            <p className="text-sm text-white/75">
              Balances are always server-authoritative. Your browser never decides a financial
              outcome.
            </p>
          </div>
        </aside>
        <div className="flex flex-col justify-center p-6 sm:p-12 xl:p-16">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5, ease }}
          >
            <h1 className="text-4xl font-bold">
              <TypeText text={title} speed={40} delay={300} />
            </h1>
            <p className="mt-2 text-ink-muted">{description}</p>
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-8 text-sm text-ink-muted">{footer}</div> : null}
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}

export const PasswordInput = forwardRef<HTMLInputElement, ComponentProps<'input'>>(
  (props, ref) => {
    const [visible, setVisible] = useState(false)
    return (
      <div className="relative">
        <Input ref={ref} {...props} type={visible ? 'text' : 'password'} className="pr-11" />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-ink-subtle transition-colors hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    )
  },
)
PasswordInput.displayName = 'PasswordInput'
