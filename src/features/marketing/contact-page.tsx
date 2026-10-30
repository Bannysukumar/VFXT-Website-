import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { AnimatePresence, motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  Bug,
  CheckCircle2,
  Clock,
  Globe2,
  KeyRound,
  Building2,
  Copy,
  Mail,
  MapPin,
  MessageSquareText,
  Navigation,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input, NativeSelect, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError } from '@/components/shared/page-header'
import { Reveal } from '@/components/motion/reveal'
import { MarketingHero, SectionHeading, StatsBand } from '@/features/marketing/marketing-hero'
import { officeLocation, supportHours } from '@/features/marketing/content'
import { env } from '@/lib/env'
import { images, videos } from '@/lib/media'
import { useAuth } from '@/features/auth/auth-context'
import { getPublicPlatformSettings } from '@/services/platform-service'

const topics = [
  { value: 'general', label: 'General question' },
  { value: 'account', label: 'Account access' },
  { value: 'deposit', label: 'Deposits' },
  { value: 'withdrawal', label: 'Withdrawals' },
  { value: 'security', label: 'Security report' },
  { value: 'legal', label: 'Legal & privacy' },
] as const

const schema = z.object({
  name: z.string().min(2, 'Please enter your name').max(100),
  email: z.string().email('Enter a valid email address'),
  topic: z.enum(topics.map((t) => t.value) as [string, ...string[]]),
  message: z.string().min(20, 'Please include at least 20 characters').max(4000),
})

type Values = z.infer<typeof schema>

const channels: { icon: LucideIcon; title: string; body: string; to: string; cta: string }[] = [
  {
    icon: MessageSquareText,
    title: 'In-app support tickets',
    body: 'Fastest for account-specific issues. Track status from open to resolved.',
    to: '/app/support',
    cta: 'Open a ticket',
  },
  {
    icon: KeyRound,
    title: 'Account recovery',
    body: 'Locked out? Request a secure password reset link instantly.',
    to: '/auth/reset',
    cta: 'Reset password',
  },
  {
    icon: Bug,
    title: 'Security reports',
    body: 'Report vulnerabilities privately using the form below with the “Security report” topic.',
    to: '/security',
    cta: 'Security overview',
  },
]

function buildAddressLines(contact?: {
  addressLine1?: string
  addressLine2?: string
  city?: string
  region?: string
  postalCode?: string
  country?: string
}) {
  if (!contact?.addressLine1 && !contact?.city) {
    return [
      officeLocation.street,
      [officeLocation.city, officeLocation.postcode].filter(Boolean).join(' '),
      officeLocation.country,
    ]
  }
  const line2 = [contact.city, contact.region, contact.postalCode].filter(Boolean).join(', ')
  return [contact.addressLine1, contact.addressLine2, line2, contact.country].filter(
    (l): l is string => Boolean(l && l.trim()),
  )
}

/** Decorative animated street map with a pulsing pin (no third-party map embed). */
function MapIllustration({ company, addressLines }: { company: string; addressLines: string[] }) {
  const roads = [
    'M0 120 C 160 100, 260 160, 420 130 S 640 90, 800 120',
    'M0 300 C 200 280, 340 340, 520 300 S 700 260, 800 290',
    'M180 0 C 200 140, 160 260, 210 420',
    'M560 0 C 540 120, 600 240, 560 420',
    'M0 220 L 800 210',
  ]
  return (
    <div className="relative min-h-80 overflow-hidden bg-brand">
      <div className="bg-grid absolute inset-0 opacity-60" />
      <svg viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden>
        <rect x="250" y="150" width="120" height="44" rx="6" fill="rgb(255 255 255 / 0.04)" />
        <rect x="430" y="235" width="90" height="50" rx="6" fill="rgb(255 255 255 / 0.04)" />
        <rect x="60" y="150" width="90" height="56" rx="6" fill="rgb(52 211 153 / 0.08)" />
        <rect x="620" y="140" width="140" height="56" rx="6" fill="rgb(255 255 255 / 0.04)" />
        {roads.map((d, i) => (
          <motion.path
            key={d}
            d={d}
            fill="none"
            stroke={i === 4 ? 'rgb(52 211 153 / 0.45)' : 'rgb(255 255 255 / 0.14)'}
            strokeWidth={i === 4 ? 3 : 10}
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.6, delay: i * 0.12, ease: 'easeInOut' }}
          />
        ))}
        <motion.path
          d="M120 360 C 220 330, 300 260, 400 215"
          fill="none"
          stroke="#c6f56f"
          strokeWidth="3"
          strokeDasharray="8 8"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-full">
        <div className="relative flex animate-float flex-col items-center">
          <span className="grid size-14 place-items-center rounded-full rounded-br-none bg-accent text-white shadow-[0_10px_30px_rgb(14_159_110/0.55)] [transform:rotate(45deg)]">
            <MapPin className="size-6 [transform:rotate(-45deg)]" />
          </span>
        </div>
      </div>
      <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-bright/70" />
      <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-pulse-ring rounded-full bg-accent-bright" />
      <div
        className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 text-white backdrop-blur-md sm:right-auto"
      >
        <MapPin className="size-5 shrink-0 text-accent-bright" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{company}</p>
          <p className="truncate text-xs text-white/60">{addressLines.join(', ')}</p>
        </div>
      </div>
    </div>
  )
}

export function ContactPage() {
  const [params] = useSearchParams()
  const { user } = useAuth()
  const [sent, setSent] = useState(false)
  const platform = useQuery({
    queryKey: ['platform', 'public'],
    queryFn: getPublicPlatformSettings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
  const contact = platform.data?.contact
  const supportEmail = contact?.email || env.VITE_SUPPORT_EMAIL
  const companyName = contact?.companyName || officeLocation.company
  const supportHoursText = contact?.supportHours
  const addressLines = useMemo(() => buildAddressLines(contact), [contact])
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [companyName, ...addressLines].join(', '),
  )}`
  const initialTopic = topics.some((t) => t.value === params.get('topic')) ? params.get('topic')! : 'general'

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: user?.displayName ?? '',
      email: user?.email ?? '',
      topic: initialTopic,
      message: '',
    },
  })
  const { errors } = form.formState
  const messageLength = form.watch('message').length

  const onSubmit = form.handleSubmit((values) => {
    if (!supportEmail) return
    const topicLabel = topics.find((t) => t.value === values.topic)?.label ?? values.topic
    const subject = `[${topicLabel}] Message from ${values.name}`
    const body = `${values.message}\n\n—\nName: ${values.name}\nReply to: ${values.email}`
    window.location.href = `mailto:${supportEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    setSent(true)
  })

  return (
    <>
      <MarketingHero
        eyebrow="Contact"
        title="Talk to the VFXT team"
        description="Questions about your account, a deposit, or how the platform works? Choose the channel that fits — or send us a message directly."
        video={videos.analystRealtime}
        poster={images.officeTalk}
      />

      {/* Channels */}
      <section className="container-page relative z-10 -mt-12 pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {channels.map(({ icon: Icon, title, body, to, cta }, i) => (
            <Reveal key={title} delay={i * 0.08}>
              <Link
                to={to}
                className="group flex h-full flex-col rounded-3xl border border-line bg-panel p-7 shadow-lift transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent transition-colors group-hover:bg-accent group-hover:text-white">
                  <Icon className="size-5" />
                </span>
                <h2 className="mt-6 text-lg">{title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-muted">{body}</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                  {cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <StatsBand
        className="border-t"
        items={[
          { value: channels.length, label: 'Support channels' },
          { value: topics.length, label: 'Message topics' },
          { value: 24, suffix: '/7', label: 'Ticket submission' },
          { value: 4000, label: 'Characters per message' },
        ]}
      />

      {/* Form + hours */}
      <section className="border-t border-line bg-panel">
        <div className="container-page grid gap-12 py-24 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <SectionHeading
              align="left"
              eyebrow="Send a message"
              title="We read every message"
              description="Never include your password, full card numbers, or private keys. We will never ask for them."
            />
            <Reveal delay={0.1} className="mt-10 space-y-4">
              <div className="rounded-2xl border border-line bg-canvas p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-brand text-accent-bright">
                    <Clock className="size-5" />
                  </span>
                  <div>
                    <p className="font-semibold">Support hours</p>
                    <p className="text-xs text-ink-muted">{supportHours.timezone}</p>
                  </div>
                </div>
                {supportHoursText ? (
                  <p className="mt-5 text-sm font-medium text-ink">{supportHoursText}</p>
                ) : (
                  <>
                    <dl className="mt-5 divide-y divide-line text-sm">
                      {supportHours.schedule.map((row) => (
                        <div key={row.days} className="flex justify-between py-2.5">
                          <dt className="text-ink-muted">{row.days}</dt>
                          <dd className="font-medium">{row.hours}</dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-4 text-xs text-ink-subtle">{supportHours.note}</p>
                  </>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-line bg-canvas p-5">
                  <Mail className="size-5 text-accent" />
                  <p className="mt-3 text-sm font-semibold">Email</p>
                  {supportEmail ? (
                    <a href={`mailto:${supportEmail}`} className="break-all text-sm text-accent hover:underline">
                      {supportEmail}
                    </a>
                  ) : (
                    <p className="text-sm text-ink-muted">Use in-app tickets</p>
                  )}
                </div>
                <div className="rounded-2xl border border-line bg-canvas p-5">
                  <Globe2 className="size-5 text-accent" />
                  <p className="mt-3 text-sm font-semibold">Response language</p>
                  <p className="text-sm text-ink-muted">English</p>
                </div>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <Card className="relative overflow-hidden shadow-lift">
              <CardContent className="p-8 sm:p-10">
                <AnimatePresence mode="wait">
                  {sent ? (
                    <motion.div
                      key="sent"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex min-h-96 flex-col items-center justify-center text-center"
                    >
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                        className="grid size-16 place-items-center rounded-full bg-accent text-white shadow-lg shadow-accent/30"
                      >
                        <CheckCircle2 className="size-8" />
                      </motion.span>
                      <h3 className="mt-6 text-2xl">Your email is ready to send</h3>
                      <p className="mt-2 max-w-sm text-sm text-ink-muted">
                        We opened your mail app with the message filled in. Press send there and we will
                        reply to the address you provided.
                      </p>
                      <Button variant="outline" className="mt-8" onClick={() => setSent(false)}>
                        Write another message
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.form
                      key="form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onSubmit={onSubmit}
                      noValidate
                      className="space-y-5"
                    >
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="name">Full name</Label>
                          <Input id="name" autoComplete="name" aria-invalid={Boolean(errors.name)} {...form.register('name')} />
                          <FieldError message={errors.name?.message} />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email address</Label>
                          <Input id="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} {...form.register('email')} />
                          <FieldError message={errors.email?.message} />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="topic">Topic</Label>
                        <NativeSelect id="topic" {...form.register('topic')}>
                          {topics.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </NativeSelect>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="message">Message</Label>
                          <span className="tabular text-xs text-ink-subtle">{messageLength}/4000</span>
                        </div>
                        <Textarea
                          id="message"
                          className="min-h-40"
                          placeholder="How can we help?"
                          aria-invalid={Boolean(errors.message)}
                          {...form.register('message')}
                        />
                        <FieldError message={errors.message?.message} />
                      </div>
                      {supportEmail ? (
                        <Button type="submit" size="lg" className="w-full">
                          <Send />
                          Send message
                        </Button>
                      ) : (
                        <div className="rounded-xl border border-warning/25 bg-warning/5 p-4 text-sm text-ink-muted">
                          Email contact is not configured yet. Please{' '}
                          <Link to="/app/support">open a support ticket</Link> instead.
                        </div>
                      )}
                      <p className="text-center text-xs text-ink-subtle">
                        By contacting us you agree to our <Link to="/legal/privacy">Privacy Policy</Link>.
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </section>

      {/* Office location */}
      <section className="container-page py-24">
        <SectionHeading
          eyebrow="Our office"
          title="Where to find us"
          description="All account matters are handled online, but you can reach our team at the address below."
        />
        <Reveal delay={0.1} className="mt-14 grid overflow-hidden rounded-3xl border border-line bg-panel shadow-lift lg:grid-cols-[1fr_1.3fr]">
          <div className="flex flex-col p-8 sm:p-10">
            <span className="grid size-12 place-items-center rounded-xl bg-brand text-accent-bright">
              <Building2 className="size-6" />
            </span>
            <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-accent">{officeLocation.label}</p>
            <h3 className="mt-1 text-2xl">{companyName}</h3>
            <address className="mt-5 flex gap-3 not-italic leading-relaxed text-ink-muted">
              <MapPin className="mt-1 size-5 shrink-0 text-accent" />
              <span>
                {addressLines.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </span>
            </address>
            {officeLocation.visiting ? (
              <p className="mt-4 flex items-center gap-3 text-sm text-ink-muted">
                <Clock className="size-5 shrink-0 text-accent" />
                {officeLocation.visiting}
              </p>
            ) : null}
            <div className="mt-auto flex flex-wrap gap-3 pt-10">
              <Button asChild>
                <a href={mapsUrl} target="_blank" rel="noreferrer">
                  <Navigation />
                  Get directions
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await navigator.clipboard.writeText(addressLines.join(', '))
                  toast.success('Address copied')
                }}
              >
                <Copy />
                Copy address
              </Button>
            </div>
          </div>
          <MapIllustration company={companyName} addressLines={addressLines} />
        </Reveal>
      </section>
    </>
  )
}
