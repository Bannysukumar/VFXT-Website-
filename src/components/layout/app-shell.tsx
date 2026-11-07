import { useEffect, useMemo, useState } from 'react'
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
  Ticket,
  UserCog,
  Home,
  Trophy,
  ArrowRightLeft,
  KeyRound,
  Settings,
  UserCircle,
  Landmark,
  History,
  Layers,
  BadgePercent,
  Gift,
  LineChart,
  Lock,
  Banknote,
  SlidersHorizontal,
  Network,
  ClipboardList,
  Zap,
  CircleDollarSign,
  Pickaxe,
  Smartphone,
  Mail,
  Plane,
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

interface NavSection {
  title: string
  items: NavItem[]
  /** When true, section starts collapsed unless a child route is active */
  collapsible?: boolean
}

const IMPERSONATOR_KEY = 'vfxt_impersonator'

const userNav: NavSection[] = [
  {
    title: 'Workspace',
    items: [
      { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/app/wallets', label: 'Wallets', icon: Wallet, end: true },
      { to: '/app/deposits', label: 'Deposit', icon: ArrowDownToLine },
      { to: '/app/withdrawals', label: 'Withdraw', icon: ArrowUpFromLine },
      { to: '/app/transfer', label: 'Transfer', icon: ArrowRightLeft },
      { to: '/app/transfers/history', label: 'Transfer history', icon: History },
    ],
  },
  {
    title: 'History',
    collapsible: true,
    items: [
      { to: '/app/transfers/history', label: 'User transfers', icon: ArrowRightLeft },
      { to: '/app/wallets/fund/history', label: 'Fund', icon: Landmark },
      { to: '/app/wallets/staking/history', label: 'Staking', icon: PiggyBank },
      { to: '/app/wallets/daily_roi/history', label: 'Daily ROI', icon: LineChart },
      { to: '/app/wallets/level_income/history', label: 'Level income', icon: Network },
      { to: '/app/wallets/direct_referral/history', label: 'Direct bonus', icon: Gift },
      { to: '/app/wallets/withdrawal/history', label: 'Withdrawal', icon: Banknote },
      { to: '/app/wallets/vfxt/history', label: 'VFXT', icon: Coins },
    ],
  },
  {
    title: 'Grow',
    items: [
      { to: '/app/staking', label: 'Staking', icon: PiggyBank },
      { to: '/app/referrals', label: 'Affiliate', icon: Users },
      { to: '/app/ranks', label: 'Ranks', icon: Trophy },
      { to: '/app/token', label: 'Token', icon: Coins },
    ],
  },
  {
    title: 'Account',
    items: [
      { to: '/app/support', label: 'Support', icon: LifeBuoy },
      { to: '/app/profile', label: 'Profile', icon: UserCircle },
    ],
  },
]

const adminNav: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/analytics', label: 'Analytics', icon: LineChart },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { to: '/admin/settings', label: 'Platform', icon: Settings },
      { to: '/admin/plan', label: 'Plan', icon: SlidersHorizontal },
      { to: '/admin/withdraw', label: 'Withdraw rules', icon: BadgePercent },
      { to: '/admin/smtp', label: 'SMTP email', icon: Mail },
      { to: '/admin/campaign', label: 'Campaign banner', icon: Plane },
    ],
  },
  {
    title: 'Operations',
    items: [
      { to: '/admin/deposits', label: 'Deposits', icon: ArrowDownToLine },
      { to: '/admin/auto-deposits', label: 'Auto deposits', icon: Zap },
      { to: '/admin/withdrawals', label: 'Withdrawals', icon: ArrowUpFromLine },
      { to: '/admin/auto-withdrawals', label: 'Auto withdrawals', icon: CircleDollarSign },
      { to: '/admin/staking', label: 'Staking', icon: PiggyBank },
      { to: '/admin/mining', label: 'Wallet mining', icon: Pickaxe },
      { to: '/admin/mining/boosters', label: 'Mining boosters', icon: Zap },
      { to: '/admin/crypto-wallet', label: 'Hot wallet', icon: KeyRound },
      { to: '/admin/swap', label: 'VFXT Swap', icon: ArrowRightLeft },
      { to: '/admin/wallet-apk', label: 'Wallet APK', icon: Smartphone },
    ],
  },
  {
    title: 'Income reports',
    collapsible: true,
    items: [
      { to: '/admin/income/roi', label: 'Daily ROI', icon: LineChart },
      { to: '/admin/income/level-commission', label: 'Level commission', icon: Network },
      { to: '/admin/income/direct-bonus', label: 'Direct bonus', icon: Gift },
      { to: '/admin/income/referral-bonus', label: 'Referral bonus', icon: Users },
      { to: '/admin/income/rank-reward', label: 'Rank rewards', icon: Trophy },
      { to: '/admin/income/staking-reward', label: 'Staking rewards', icon: PiggyBank },
      { to: '/admin/income/locked-maturity', label: 'Locked maturity', icon: Lock },
      { to: '/admin/income/locked-bonus', label: 'Locked bonus', icon: Layers },
      { to: '/admin/income/deposit-credit', label: 'Deposit credits', icon: Landmark },
      { to: '/admin/peer-transfers', label: 'User transfers', icon: ArrowRightLeft },
    ],
  },
  {
    title: 'Members',
    items: [
      { to: '/admin/users', label: 'Users', icon: UserCog },
      { to: '/admin/affiliates', label: 'Affiliates', icon: Users },
      { to: '/admin/peer-transfers', label: 'User transfers', icon: ArrowRightLeft },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/tickets', label: 'Tickets', icon: Ticket },
      { to: '/admin/audit', label: 'Audit log', icon: ClipboardList },
    ],
  },
]

const titles: Record<string, string> = {
  '/app': 'Dashboard',
  '/app/wallets': 'Wallets',
  '/app/wallets/fund/history': 'Fund history',
  '/app/wallets/staking/history': 'Staking history',
  '/app/wallets/daily_roi/history': 'Daily ROI history',
  '/app/wallets/level_income/history': 'Level income history',
  '/app/wallets/direct_referral/history': 'Direct bonus history',
  '/app/wallets/withdrawal/history': 'Withdrawal history',
  '/app/wallets/vfxt/history': 'VFXT history',
  '/app/deposits': 'Deposit',
  '/app/withdrawals': 'Withdraw',
  '/app/transfer': 'Transfer',
  '/app/transfers/history': 'Transfer history',
  '/app/token': 'Token',
  '/app/referrals': 'Affiliate',
  '/app/referrals/level/1': 'Level 1',
  '/app/referrals/level/2': 'Level 2',
  '/app/referrals/level/3': 'Level 3',
  '/app/referrals/level/4': 'Level 4',
  '/app/referrals/level/5': 'Level 5',
  '/app/referrals/level/6': 'Level 6',
  '/app/referrals/level/7': 'Level 7',
  '/app/staking': 'Staking',
  '/app/ranks': 'Ranks',
  '/app/support': 'Support',
  '/app/profile': 'Profile',
  '/admin': 'Dashboard',
  '/admin/analytics': 'Analytics',
  '/admin/settings': 'Platform settings',
  '/admin/plan': 'Plan',
  '/admin/withdraw': 'Withdraw rules',
  '/admin/deposits': 'Deposits',
  '/admin/auto-deposits': 'Auto deposits',
  '/admin/withdrawals': 'Withdrawals',
  '/admin/auto-withdrawals': 'Auto withdrawals',
  '/admin/income/roi': 'Daily ROI',
  '/admin/income/level-commission': 'Level commission',
  '/admin/income/direct-bonus': 'Direct bonus',
  '/admin/income/referral-bonus': 'Referral bonus',
  '/admin/income/rank-reward': 'Rank rewards',
  '/admin/income/staking-reward': 'Staking rewards',
  '/admin/income/locked-maturity': 'Locked maturity',
  '/admin/income/locked-bonus': 'Locked bonus',
  '/admin/income/deposit-credit': 'Deposit credits',
  '/admin/peer-transfers': 'User transfers',
  '/admin/staking': 'Staking',
  '/admin/mining': 'Wallet mining',
  '/admin/mining/boosters': 'Mining boosters',
  '/admin/mining/boosters/history': 'Booster history',
  '/admin/mining/boosters/active': 'Active boosters',
  '/admin/crypto-wallet': 'Hot wallet',
  '/admin/swap': 'VFXT Swap',
  '/admin/wallet-apk': 'Wallet APK',
  '/admin/campaign': 'Campaign banner',
  '/admin/users': 'Users',
  '/admin/affiliates': 'Affiliates',
  '/admin/tickets': 'Tickets',
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

function sectionHasActive(section: NavSection, pathname: string) {
  const path = pathname.replace(/\/$/, '') || '/'
  return section.items.some((item) => {
    if (item.end) return path === item.to
    return path === item.to || path.startsWith(`${item.to}/`)
  })
}

function NavSectionBlock({
  section,
  variant,
  onNavigate,
}: {
  section: NavSection
  variant: 'user' | 'admin'
  onNavigate: () => void
}) {
  const { pathname } = useLocation()
  const active = sectionHasActive(section, pathname)
  const [open, setOpen] = useState(() => !section.collapsible || active)

  useEffect(() => {
    if (active) setOpen(true)
  }, [active])

  const headerId = `nav-section-${variant}-${section.title.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <div>
      {section.collapsible ? (
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mb-1.5 flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left transition-colors hover:bg-white/[0.04]"
        >
          <History className="size-3 text-white/30" aria-hidden />
          <span className="flex-1 text-[11px] font-semibold text-white/40">
            {section.title}
          </span>
          <ChevronDown
            className={cn(
              'size-3.5 text-white/30 transition-transform duration-200',
              open ? 'rotate-0' : '-rotate-90',
            )}
          />
        </button>
      ) : (
        <p className="mb-1.5 px-3 text-[11px] font-semibold text-white/40">
          {section.title}
        </p>
      )}

      {open || !section.collapsible ? (
        <div
          className="space-y-0.5"
          role={section.collapsible ? 'region' : undefined}
          aria-labelledby={section.collapsible ? headerId : undefined}
        >
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white',
                  isActive && 'bg-white/[0.12] text-white ring-1 ring-inset ring-white/5',
                  item.disabled && 'pointer-events-none opacity-40',
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive ? (
                    <motion.span
                      layoutId={`nav-indicator-${variant}`}
                      className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-accent-bright"
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  ) : null}
                  <span
                    className={cn(
                      'grid size-7 shrink-0 place-items-center rounded-md transition-colors',
                      isActive
                        ? 'bg-accent-bright/15 text-accent-bright'
                        : 'bg-white/[0.04] text-white/40 group-hover:bg-white/[0.08] group-hover:text-white/75',
                    )}
                  >
                    <item.icon className="size-3.5" />
                  </span>
                  <span className="truncate">{item.label}</span>
                  {item.disabled ? (
                    <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold">
                      Soon
                    </span>
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
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
  const sections = useMemo(() => (variant === 'admin' ? adminNav : userNav), [variant])
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
    <div className="min-h-dvh lg:grid lg:grid-cols-[280px_1fr]">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col overflow-hidden bg-brand text-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-dvh lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >

        <div className="relative flex h-[4.25rem] items-center justify-between border-b border-white/[0.08] px-5">
          <Link to={homePath} aria-label="VFXT dashboard" className="flex items-center gap-2.5">
            <Logo inverted />
            {variant === 'admin' ? (
              <span className="rounded-md bg-highlight/95 px-1.5 py-0.5 text-[10px] font-boldr text-brand">
                Admin
              </span>
            ) : (
              <span className="hidden text-[10px] font-semibold text-white/35 sm:inline">
                Member
              </span>
            )}
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

        <nav className="relative flex-1 space-y-5 overflow-y-auto px-3 py-4 [scrollbar-width:thin]">
          {sections.map((section) => (
            <NavSectionBlock
              key={section.title}
              section={section}
              variant={variant}
              onNavigate={() => setSidebarOpen(false)}
            />
          ))}
        </nav>

        <div className="relative space-y-3 border-t border-white/[0.08] p-3">
          {variant === 'user' ? (
            <Link
              to="/app/token"
              onClick={() => setSidebarOpen(false)}
              className="group relative block overflow-hidden rounded-xl p-3.5"
            >
              <img
                src={images.cryptoDesk.replace(/w=\d+/, 'w=500')}
                alt=""
                className="absolute inset-0 size-full object-cover opacity-35"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-accent/85 to-brand/95" />
              <div className="relative flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-white/10">
                  <Coins className="size-4 text-highlight" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">VFXT token</p>
                  <p className="text-xs text-white/65">Roadmap & utility</p>
                </div>
              </div>
            </Link>
          ) : (
            <Link
              to="/app"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/[0.06] hover:text-white"
            >
              <Home className="size-4" />
              Member app
            </Link>
          )}
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
            <Avatar name={displayName} className="size-9" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs capitalize text-white/45">
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
            ) : isAdmin ? (
              <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
                <Link to="/admin/settings">
                  <Settings />
                  Settings
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
                <DropdownMenuItem asChild>
                  <Link to="/app/profile">
                    <UserCircle />
                    Profile
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
          className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8"
        >
          <Outlet />
        </motion.main>
      </div>
    </div>
  )
}
