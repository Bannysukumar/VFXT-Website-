import { useEffect, useMemo, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Menu, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Logo } from '@/components/shared/logo'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { getPublicPlatformSettings } from '@/services/platform-service'

const links = [
  { to: '/about', label: 'About' },
  { to: '/security', label: 'Security' },
  { to: '/token', label: 'Token' },
  { to: '/support', label: 'Support' },
  { to: '/contact', label: 'Contact' },
]

const footerColumns = [
  {
    title: 'Platform',
    links: [
      { to: '/auth/register', label: 'Open account' },
      { to: '/auth/login', label: 'Sign in' },
      { to: '/token', label: 'VFXT token' },
    ],
  },
  {
    title: 'Company',
    links: [
      { to: '/about', label: 'About' },
      { to: '/security', label: 'Security & trust' },
      { to: '/support', label: 'Support' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/legal/terms', label: 'Terms of Service' },
      { to: '/legal/privacy', label: 'Privacy Policy' },
      { to: '/legal/risk', label: 'Risk Disclosure' },
    ],
  },
]

export function PublicShell() {
  const { user } = useAuth()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const platform = useQuery({
    queryKey: ['platform', 'public'],
    queryFn: getPublicPlatformSettings,
    staleTime: 5 * 60 * 1000,
    retry: false,
  })

  const footerColumnsResolved = useMemo(() => {
    const remote = platform.data?.footer?.columns
    if (remote?.length) {
      return remote.map((col) => ({
        title: col.title,
        links: col.links.map((l) => ({ to: l.href, label: l.label })),
      }))
    }
    return footerColumns
  }, [platform.data?.footer?.columns])

  const footerTagline =
    platform.data?.footer?.tagline ??
    'Virtual FX Trades — secure wallets, verified settlements, and future on-chain token rails.'
  const footerCopyright =
    platform.data?.footer?.copyright ??
    `© ${new Date().getFullYear()} Virtual FX Trades. All rights reserved.`
  // Every public page except auth opens with a dark full-bleed hero.
  const hasDarkHero = !location.pathname.startsWith('/auth')

  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
  }, [location.pathname])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // The header sits transparently on the dark hero until the user scrolls.
  const onDark = hasDarkHero && !scrolled && !mobileOpen

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 transition-colors duration-200',
          onDark
            ? 'border-b border-transparent bg-transparent'
            : 'border-b border-line bg-panel/85 backdrop-blur-lg',
        )}
      >
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link to="/" aria-label="VFXT home">
            <Logo inverted={onDark} />
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    onDark ? 'text-white/70 hover:text-white' : 'text-ink-muted hover:text-ink',
                    isActive && (onDark ? 'text-white' : 'text-ink'),
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            {user ? (
              <Button asChild variant={onDark ? 'light' : 'default'}>
                <Link to="/app">
                  Go to dashboard
                  <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  asChild
                  className={onDark ? 'text-white/80 hover:bg-white/10 hover:text-white' : undefined}
                >
                  <Link to="/auth/login">Sign in</Link>
                </Button>
                <Button asChild variant={onDark ? 'light' : 'default'}>
                  <Link to="/auth/register">Get started</Link>
                </Button>
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn('md:hidden', onDark && 'text-white hover:bg-white/10 hover:text-white')}
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X /> : <Menu />}
          </Button>
        </div>
        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-line bg-panel md:hidden"
            >
              <div className="container-page flex flex-col gap-1 py-4">
                {links.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-panel-elevated"
                  >
                    {link.label}
                  </NavLink>
                ))}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {user ? (
                    <Button asChild className="col-span-2">
                      <Link to="/app">Go to dashboard</Link>
                    </Button>
                  ) : (
                    <>
                      <Button asChild variant="outline">
                        <Link to="/auth/login">Sign in</Link>
                      </Button>
                      <Button asChild>
                        <Link to="/auth/register">Get started</Link>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <motion.main
        key={location.pathname}
        className={cn('flex-1', !hasDarkHero && 'pt-16')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        <Outlet />
      </motion.main>

      <footer className="bg-brand text-white">
        <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo inverted />
            <p className="mt-4 text-sm leading-relaxed text-white/60">{footerTagline}</p>
          </div>
          {footerColumnsResolved.map((column) => (
            <div key={column.title}>
              <p className="text-xs font-semibold uppercase tracking-wider text-white/40">
                {column.title}
              </p>
              <ul className="mt-3 space-y-0.5">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="inline-block py-1.5 text-sm text-white/70 transition-colors hover:text-white"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10">
          <div className="container-page flex flex-col gap-2 py-6 text-xs text-white/45 sm:flex-row sm:items-center sm:justify-between">
            <p>{footerCopyright}</p>
            <p>
              Returns are not guaranteed and you can lose the money you deposit.{' '}
              <Link to="/legal/risk" className="inline-block py-1.5 font-medium text-white/70 underline underline-offset-2 hover:text-white">
                Read the risk disclosure
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
