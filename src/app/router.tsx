import { lazy, type ComponentType, useEffect } from 'react'
import { createBrowserRouter, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { PublicShell } from '@/components/layout/public-shell'
import { AppShell } from '@/components/layout/app-shell'
import { AdminRoute, ProtectedRoute } from '@/features/auth/components/protected-route'
import { handleStaleChunkError, isStaleChunkError, reloadForNewDeploy } from '@/lib/chunk-reload'
import { Button } from '@/components/ui/button'

/** Lazy-load a named page export so admin/app code is not in the first paint bundle. */
function lazyNamed<T extends Record<string, unknown>>(
  loader: () => Promise<T>,
  exportName: keyof T & string,
) {
  return lazy(async () => {
    try {
      const mod = await loader()
      const Comp = mod[exportName] as ComponentType
      return { default: Comp }
    } catch (err) {
      // Old tab after deploy → missing hashed chunk. Reload to pick up new index.html.
      if (handleStaleChunkError(err)) {
        return { default: () => null }
      }
      throw err
    }
  })
}

function RouteErrorPage() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'Unexpected application error'

  useEffect(() => {
    if (isStaleChunkError(error)) {
      reloadForNewDeploy()
    }
  }, [error])

  if (isStaleChunkError(error)) {
    return (
      <div className="container-page flex min-h-dvh flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-ink-muted">Updating the app…</p>
      </div>
    )
  }

  return (
    <div className="container-page flex min-h-dvh flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-2xl font-semibold text-ink">Something went wrong</h1>
      <p className="max-w-md text-sm text-ink-muted">{message}</p>
      <Button type="button" onClick={() => window.location.reload()}>
        Refresh page
      </Button>
    </div>
  )
}

const HomePage = lazyNamed(() => import('@/features/marketing/home-page'), 'HomePage')
const AboutPage = lazyNamed(() => import('@/features/marketing/about-page'), 'AboutPage')
const TokenPublicPage = lazyNamed(
  () => import('@/features/token/pages/token-public-page'),
  'TokenPublicPage',
)
const SupportPublicPage = lazyNamed(
  () => import('@/features/marketing/support-public-page'),
  'SupportPublicPage',
)
const SecurityPage = lazyNamed(() => import('@/features/marketing/security-page'), 'SecurityPage')
const DownloadPage = lazyNamed(() => import('@/features/marketing/download-page'), 'DownloadPage')
const WalletPage = lazyNamed(() => import('@/features/marketing/wallet-page'), 'WalletPage')
const MiningPage = lazyNamed(() => import('@/features/marketing/mining-page'), 'MiningPage')
const ContactPage = lazyNamed(() => import('@/features/marketing/contact-page'), 'ContactPage')
const TermsPage = lazyNamed(() => import('@/features/marketing/legal-page'), 'TermsPage')
const PrivacyPage = lazyNamed(() => import('@/features/marketing/legal-page'), 'PrivacyPage')
const RiskDisclosurePage = lazyNamed(
  () => import('@/features/marketing/legal-page'),
  'RiskDisclosurePage',
)
const LoginPage = lazyNamed(() => import('@/features/auth/pages/login-page'), 'LoginPage')
const RegisterPage = lazyNamed(() => import('@/features/auth/pages/register-page'), 'RegisterPage')
const WalletRegisterPage = lazyNamed(
  () => import('@/features/auth/pages/wallet-register-page'),
  'WalletRegisterPage',
)
const ResetPasswordPage = lazyNamed(
  () => import('@/features/auth/pages/reset-password-page'),
  'ResetPasswordPage',
)
const AuthActionPage = lazyNamed(
  () => import('@/features/auth/pages/auth-action-page'),
  'AuthActionPage',
)

const DashboardPage = lazyNamed(
  () => import('@/features/dashboard/pages/dashboard-page'),
  'DashboardPage',
)
const WalletsPage = lazyNamed(() => import('@/features/wallets/pages/wallets-page'), 'WalletsPage')
const WalletHistoryPage = lazyNamed(
  () => import('@/features/wallets/pages/wallet-history-page'),
  'WalletHistoryPage',
)
const DepositsPage = lazyNamed(
  () => import('@/features/deposits/pages/deposits-page'),
  'DepositsPage',
)
const WithdrawalsPage = lazyNamed(
  () => import('@/features/withdrawals/pages/withdrawals-page'),
  'WithdrawalsPage',
)
const TransferPage = lazyNamed(
  () => import('@/features/wallets/pages/transfer-page'),
  'TransferPage',
)
const PeerTransferHistoryPage = lazyNamed(
  () => import('@/features/wallets/pages/peer-transfer-history-page'),
  'PeerTransferHistoryPage',
)
const ReferralsPage = lazyNamed(
  () => import('@/features/referrals/pages/referrals-page'),
  'ReferralsPage',
)
const ReferralLevelPage = lazyNamed(
  () => import('@/features/referrals/pages/referral-level-page'),
  'ReferralLevelPage',
)
const StakingPage = lazyNamed(() => import('@/features/staking/pages/staking-page'), 'StakingPage')
const RanksPage = lazyNamed(() => import('@/features/ranks/pages/ranks-page'), 'RanksPage')
const SupportPage = lazyNamed(() => import('@/features/support/pages/support-page'), 'SupportPage')
const ProfilePage = lazyNamed(() => import('@/features/profile/pages/profile-page'), 'ProfilePage')

const AdminDashboardPage = lazyNamed(
  () => import('@/features/admin/pages/admin-dashboard-page'),
  'AdminDashboardPage',
)
const AdminAnalyticsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-analytics-page'),
  'AdminAnalyticsPage',
)
const AdminDepositsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-deposits-page'),
  'AdminDepositsPage',
)
const AdminAutoDepositsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-auto-deposits-page'),
  'AdminAutoDepositsPage',
)
const AdminWithdrawalsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-withdrawals-page'),
  'AdminWithdrawalsPage',
)
const AdminAutoWithdrawalsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-auto-withdrawals-page'),
  'AdminAutoWithdrawalsPage',
)
const AdminIncomePage = lazyNamed(
  () => import('@/features/admin/pages/admin-income-page'),
  'AdminIncomePage',
)
const AdminPeerTransfersPage = lazyNamed(
  () => import('@/features/admin/pages/admin-peer-transfers-page'),
  'AdminPeerTransfersPage',
)
const AdminStakingPage = lazyNamed(
  () => import('@/features/admin/pages/admin-staking-page'),
  'AdminStakingPage',
)
const AdminMiningPage = lazyNamed(
  () => import('@/features/admin/pages/admin-mining-page'),
  'AdminMiningPage',
)
const AdminMiningBoostersPage = lazyNamed(
  () => import('@/features/admin/pages/admin-mining-boosters-page'),
  'AdminMiningBoostersPage',
)
const AdminMiningBoosterHistoryPage = lazyNamed(
  () => import('@/features/admin/pages/admin-mining-booster-history-page'),
  'AdminMiningBoosterHistoryPage',
)
const AdminMiningBoosterActivePage = lazyNamed(
  () => import('@/features/admin/pages/admin-mining-booster-active-page'),
  'AdminMiningBoosterActivePage',
)
const AdminCryptoWalletPage = lazyNamed(
  () => import('@/features/admin/pages/admin-crypto-wallet-page'),
  'AdminCryptoWalletPage',
)
const AdminSwapPage = lazyNamed(
  () => import('@/features/admin/pages/admin-swap-page'),
  'AdminSwapPage',
)
const AdminWalletApkPage = lazyNamed(
  () => import('@/features/admin/pages/admin-wallet-apk-page'),
  'AdminWalletApkPage',
)
const AdminCampaignPage = lazyNamed(
  () => import('@/features/admin/pages/admin-campaign-page'),
  'AdminCampaignPage',
)
const AdminTransferControlsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-transfer-controls-page'),
  'AdminTransferControlsPage',
)
const AdminUsersPage = lazyNamed(
  () => import('@/features/admin/pages/admin-users-page'),
  'AdminUsersPage',
)
const AdminAffiliatesPage = lazyNamed(
  () => import('@/features/admin/pages/admin-affiliates-page'),
  'AdminAffiliatesPage',
)
const AdminTicketsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-tickets-page'),
  'AdminTicketsPage',
)
const AdminAuditPage = lazyNamed(
  () => import('@/features/admin/pages/admin-audit-page'),
  'AdminAuditPage',
)
const AdminSettingsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-settings-page'),
  'AdminSettingsPage',
)
const AdminPlanPage = lazyNamed(
  () => import('@/features/admin/pages/admin-plan-page'),
  'AdminPlanPage',
)
const AdminWithdrawSettingsPage = lazyNamed(
  () => import('@/features/admin/pages/admin-withdraw-settings-page'),
  'AdminWithdrawSettingsPage',
)
const AdminSmtpPage = lazyNamed(
  () => import('@/features/admin/pages/admin-smtp-page'),
  'AdminSmtpPage',
)

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'token', element: <TokenPublicPage /> },
      { path: 'support', element: <SupportPublicPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: 'download', element: <DownloadPage /> },
      { path: 'wallet', element: <WalletPage /> },
      { path: 'mining', element: <MiningPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'legal/terms', element: <TermsPage /> },
      { path: 'legal/privacy', element: <PrivacyPage /> },
      { path: 'legal/risk', element: <RiskDisclosurePage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/register', element: <RegisterPage /> },
      { path: 'auth/wallet-register', element: <WalletRegisterPage /> },
      { path: 'auth/reset', element: <ResetPasswordPage /> },
      // Firebase email links (verify / reset) when action URL is this site.
      { path: 'auth/action', element: <AuthActionPage /> },
    ],
  },
  {
    path: '/app',
    element: <ProtectedRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'wallets', element: <WalletsPage /> },
          { path: 'wallets/:kind/history', element: <WalletHistoryPage /> },
          { path: 'deposits', element: <DepositsPage /> },
          { path: 'withdrawals', element: <WithdrawalsPage /> },
          { path: 'transfer', element: <TransferPage /> },
          { path: 'transfers/history', element: <PeerTransferHistoryPage /> },
          { path: 'token', element: <TokenPublicPage /> },
          { path: 'referrals', element: <ReferralsPage /> },
          { path: 'referrals/level/:level', element: <ReferralLevelPage /> },
          { path: 'staking', element: <StakingPage /> },
          { path: 'ranks', element: <RanksPage /> },
          { path: 'support', element: <SupportPage /> },
          { path: 'profile', element: <ProfilePage /> },
        ],
      },
    ],
  },
  {
    path: '/admin',
    element: <AdminRoute />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <AppShell variant="admin" />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
          { path: 'analytics', element: <AdminAnalyticsPage /> },
          { path: 'deposits', element: <AdminDepositsPage /> },
          { path: 'auto-deposits', element: <AdminAutoDepositsPage /> },
          { path: 'withdrawals', element: <AdminWithdrawalsPage /> },
          { path: 'auto-withdrawals', element: <AdminAutoWithdrawalsPage /> },
          { path: 'income/:incomeType', element: <AdminIncomePage /> },
          { path: 'peer-transfers', element: <AdminPeerTransfersPage /> },
          { path: 'staking', element: <AdminStakingPage /> },
          { path: 'mining', element: <AdminMiningPage /> },
          { path: 'mining/boosters', element: <AdminMiningBoostersPage /> },
          { path: 'mining/boosters/history', element: <AdminMiningBoosterHistoryPage /> },
          { path: 'mining/boosters/active', element: <AdminMiningBoosterActivePage /> },
          { path: 'crypto-wallet', element: <AdminCryptoWalletPage /> },
          { path: 'swap', element: <AdminSwapPage /> },
          { path: 'wallet-apk', element: <AdminWalletApkPage /> },
          { path: 'campaign', element: <AdminCampaignPage /> },
          { path: 'transfers', element: <AdminTransferControlsPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'affiliates', element: <AdminAffiliatesPage /> },
          { path: 'tickets', element: <AdminTicketsPage /> },
          { path: 'audit', element: <AdminAuditPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
          { path: 'plan', element: <AdminPlanPage /> },
          { path: 'withdraw', element: <AdminWithdrawSettingsPage /> },
          { path: 'smtp', element: <AdminSmtpPage /> },
        ],
      },
    ],
  },
])
