import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Shield,
  Coins,
  Users,
  Wallet,
  LifeBuoy,
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  Globe,
  ChevronDown,
  ChevronRight,
  ScrollText,
  Ticket,
  UserCog,
  Home,
  Trophy,
  ArrowRightLeft,
  KeyRound,
  Settings,
  UserCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/shared/logo'
import { useAuth } from '@/features/auth/auth-context'
import { logout } from '@/services/auth-service'
import { useUiStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'
import { images } from '@/lib/media'
import { toast } from 'sonner'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  disabled?: boolean
}

const IMPERSONATOR_KEY = 'vfxt_impersonator'

const userNav: { title: string; items: NavItem[] }[] = [
  {
    title: 'Main',
    items: [
      { to: '/app', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/app/wallets', label: 'Wallets', icon: Wallet },
      { to: '/app/deposits', label: 'Deposits', icon: ArrowDownToLine },
      { to: '/app/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
      { to: '/app/transfer', label: 'Transfer', icon: ArrowRightLeft },
    ],
  },
  {
    title: 'Earn',
    items: [
      { to: '/app/staking', label: 'Staking', icon: PiggyBank },
      { to: '/app/referrals', label: 'Affiliate', icon: Users },
      { to: '/app/ranks', label: 'Ranks', icon: Trophy },
      { to: '/app/token', label: 'Token', icon: Coins },
    ],
  },
  {
    title: 'Help',
    items: [
      { to: '/app/support', label: 'Support', icon: LifeBuoy },
      { to: '/app/profile', label: 'Profile', icon: UserCircle },
    ],
  },
]

const adminNav: { title: string; items: NavItem[] }[] = [
  {
    title: 'Console',
    items: [
      { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
  {
    title: 'Finance',
    items: [
      { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine },
      { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
      { to: '/admin/staking', label: 'Staking', icon: PiggyBank },
      { to: '/admin/crypto-wallet', label: 'Crypto wallet', icon: KeyRound },
    ],
  },
  {
    title: 'Network',
    items: [
      { to: '/admin/users', label: 'Users', icon: UserCog },
      { to: '/admin/affiliates', label: 'Affiliates', icon: Users },
    ],
  },
  {
    title: 'Support',
    items: [
      { to: '/admin/tickets', label: 'Support tickets', icon: Ticket },
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
]

const titles: Record<string, string> = {
  '/app': 'Overview',
  '/app/wallets': 'Wallets',
  '/app/deposits': 'Deposits',
  '/app/withdrawals': 'Withdrawals',
  '/app/transfer': 'Transfer',
  '/app/token': 'Token',
  '/app/referrals': 'Affiliate',
  '/app/staking': 'Staking',
  '/app/ranks': 'Ranks',
  '/app/support': 'Support',
  '/app/profile': 'Profile',
  '/admin': 'Overview',
  '/admin/settings': 'Settings',
  '/admin/deposits': 'Deposits',
  '/admin/withdrawals': 'Withdrawals',
  '/admin/staking': 'Staking',
  '/admin/crypto-wallet': 'Crypto wallet',
  '/admin/users': 'Users',
  '/admin/affiliates': 'Affiliates',
  '/admin/tickets': 'Support tickets',
  '/admin/audit': 'Audit log',
}

function initials(name: string) {
  return name
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent-bright to-highlight text-xs font-bold text-brand',
        className,
      )}
    >
      {initials(name)}
    </span>
  )
}

export function AppShell({ variant = 'user' }: { variant?: 'user' | 'admin' }) {
  const { user, isAdmin, adminRole } = useAuth()
  const { sidebarOpen, setSidebarOpen, toggleSidebar } = useUiStore()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const displayName = user?.displayName || user?.email?.split('@')[0] || 'Account'
  const normalized = pathname.replace(/\/$/, '') || '/'
  const pageTitle = titles[normalized] ?? 'Dashboard'
  const sections = variant === 'admin' ? adminNav : userNav
  const homePath = variant === 'admin' ? '/admin' : '/app'
  const [impersonatorUid, setImpersonatorUid] = useState<string | null>(() =>
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(IMPERSONATOR_KEY) : null,
  )

  useEffect(() => {
    setImpersonatorUid(sessionStorage.getItem(IMPERSONATOR_KEY))
  }, [user?.uid])

  const signOut = async () => {
    sessionStorage.removeItem(IMPERSONATOR_KEY)
    setImpersonatorUid(null)
    await logout()
    toast.success('Signed out')
  }

  const exitImpersonation = async () => {
    sessionStorage.removeItem(IMPERSONATOR_KEY)
    setImpersonatorUid(null)
    await logout()
    toast.info('Signed out. Sign in again with your admin account.')
    navigate('/auth/login')
  }

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[272px_1fr]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col overflow-hidden bg-brand text-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative flex h-16 items-center justify-between px-5">
          <Link to={homePath} aria-label="VFXT dashboard" className="flex items-center gap-2">
            <Logo inverted />
            {variant === 'admin' ? (
              <span className="rounded-md bg-highlight px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand">
                Admin
              </span>
            ) : null}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X />
          </Button>
        </div>

        <nav className="relative flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/35">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={() => setSidebarOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white',
                        isActive && 'bg-white/10 text-white',
                        item.disabled && 'pointer-events-none opacity-40',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive ? (
                          <motion.span
                            layoutId={`nav-indicator-${variant}`}
                            className="absolute inset-y-1.5 left-0 w-1 rounded-r-full bg-accent-bright"
                            transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                          />
                        ) : null}
                        <item.icon
                          className={cn(
                            'size-[18px] transition-colors',
                            isActive ? 'text-accent-bright' : 'text-white/45 group-hover:text-white/80',
                          )}
                        />
                        {item.label}
                        {item.disabled ? (
                          <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                            Soon
                          </span>
                        ) : null}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="relative space-y-3 p-3">
          {variant === 'user' ? (
            <Link
              to="/app/token"
              onClick={() => setSidebarOpen(false)}
              className="group relative block overflow-hidden rounded-xl p-4"
            >
              <img src={images.cryptoDesk.replace(/w=\d+/, 'w=500')} alt="" className="absolute inset-0 size-full object-cover opacity-40 transition-transform duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-br from-accent/80 to-brand/90" />
              <div className="relative">
                <Coins className="size-5 text-highlight" />
                <p className="mt-2 text-sm font-semibold text-white">VFXT token</p>
                <p className="text-xs text-white/70">See the launch roadmap</p>
              </div>
            </Link>
          ) : (
            <Link
              to="/app"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white"
            >
              <Home className="size-4" />
              Back to user app
            </Link>
          )}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <Avatar name={displayName} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-white/45">
                {variant === 'admin' ? adminRole?.replaceAll('_', ' ') ?? 'admin' : user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-white/50 hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
              onClick={signOut}
            >
              <LogOut />
            </Button>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <button
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <div className="flex min-h-dvh min-w-0 flex-col">
        {variant === 'user' && impersonatorUid ? (
          <div className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-warning/30 bg-warning/10 px-4 py-2 text-sm sm:px-6 lg:px-8">
            <p className="text-ink">
              Viewing as user — you are impersonating an account. Exit to return to admin (sign in
              again).
            </p>
            <Button variant="outline" size="sm" onClick={() => void exitImpersonation()}>
              Exit
            </Button>
          </div>
        ) : null}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-panel/80 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={toggleSidebar} aria-label="Open menu">
              <Menu />
            </Button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
              <Link to={homePath} className="hidden text-ink-muted hover:text-ink sm:inline">
                {variant === 'admin' ? 'Admin' : 'Dashboard'}
              </Link>
              <ChevronRight className="hidden size-4 text-ink-subtle sm:block" />
              <span className="truncate font-display font-semibold">{pageTitle}</span>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {variant === 'user' ? (
              <Button variant="accent" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/app/deposits">
                  <ArrowDownToLine />
                  Deposit
                </Link>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2.5 transition-colors hover:bg-panel-elevated focus-visible:ring-4 focus-visible:ring-accent/20"
                >
                  <Avatar name={displayName} className="size-8" />
                  <span className="hidden max-w-32 truncate text-sm font-medium md:inline">{displayName}</span>
                  <ChevronDown className="size-4 text-ink-subtle" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <p className="text-sm font-semibold">{displayName}</p>
                  <p className="truncate text-xs text-ink-muted">{user?.email}</p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/app">
                    <LayoutDashboard />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/app/wallets">
                    <Wallet />
                    Wallets
                  </Link>
                </DropdownMenuItem>
                {isAdmin ? (
                  <DropdownMenuItem asChild>
                    <Link to="/admin">
                      <Shield />
                      Admin console
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  <Link to="/">
                    <Globe />
                    Public website
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={signOut} className="text-danger [&_svg]:text-danger">
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <motion.main
          key={normalized}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}
