import { createBrowserRouter } from 'react-router-dom'
import { PublicShell } from '@/components/layout/public-shell'
import { AppShell } from '@/components/layout/app-shell'
import { AdminRoute, ProtectedRoute } from '@/features/auth/components/protected-route'
import { LoginPage } from '@/features/auth/pages/login-page'
import { RegisterPage } from '@/features/auth/pages/register-page'
import { WalletRegisterPage } from '@/features/auth/pages/wallet-register-page'
import { ResetPasswordPage } from '@/features/auth/pages/reset-password-page'
import { HomePage } from '@/features/marketing/home-page'
import { AboutPage } from '@/features/marketing/about-page'
import { TokenPublicPage } from '@/features/token/pages/token-public-page'
import { DashboardPage } from '@/features/dashboard/pages/dashboard-page'
import { WalletsPage } from '@/features/wallets/pages/wallets-page'
import { WalletHistoryPage } from '@/features/wallets/pages/wallet-history-page'
import { DepositsPage } from '@/features/deposits/pages/deposits-page'
import { WithdrawalsPage } from '@/features/withdrawals/pages/withdrawals-page'
import { ReferralsPage } from '@/features/referrals/pages/referrals-page'
import { ReferralLevelPage } from '@/features/referrals/pages/referral-level-page'
import { StakingPage } from '@/features/staking/pages/staking-page'
import { RanksPage } from '@/features/ranks/pages/ranks-page'
import { SupportPage } from '@/features/support/pages/support-page'
import { TransferPage } from '@/features/wallets/pages/transfer-page'
import { PeerTransferHistoryPage } from '@/features/wallets/pages/peer-transfer-history-page'
import { AdminPeerTransfersPage } from '@/features/admin/pages/admin-peer-transfers-page'
import { AdminDashboardPage } from '@/features/admin/pages/admin-dashboard-page'
import { AdminDepositsPage } from '@/features/admin/pages/admin-deposits-page'
import { AdminWithdrawalsPage } from '@/features/admin/pages/admin-withdrawals-page'
import { AdminUsersPage } from '@/features/admin/pages/admin-users-page'
import { AdminTicketsPage } from '@/features/admin/pages/admin-tickets-page'
import { AdminAuditPage } from '@/features/admin/pages/admin-audit-page'
import { AdminStakingPage } from '@/features/admin/pages/admin-staking-page'
import { AdminMiningPage } from '@/features/admin/pages/admin-mining-page'
import { AdminMiningBoostersPage } from '@/features/admin/pages/admin-mining-boosters-page'
import { AdminMiningBoosterHistoryPage } from '@/features/admin/pages/admin-mining-booster-history-page'
import { AdminMiningBoosterActivePage } from '@/features/admin/pages/admin-mining-booster-active-page'
import { AdminAffiliatesPage } from '@/features/admin/pages/admin-affiliates-page'
import { AdminCryptoWalletPage } from '@/features/admin/pages/admin-crypto-wallet-page'
import { AdminSettingsPage } from '@/features/admin/pages/admin-settings-page'
import { AdminPlanPage } from '@/features/admin/pages/admin-plan-page'
import { AdminWithdrawSettingsPage } from '@/features/admin/pages/admin-withdraw-settings-page'
import { AdminAutoDepositsPage } from '@/features/admin/pages/admin-auto-deposits-page'
import { AdminAutoWithdrawalsPage } from '@/features/admin/pages/admin-auto-withdrawals-page'
import { AdminIncomePage } from '@/features/admin/pages/admin-income-page'
import { ProfilePage } from '@/features/profile/pages/profile-page'
import { TokenPublicPage as AppTokenPage } from '@/features/token/pages/token-public-page'
import { SupportPublicPage } from '@/features/marketing/support-public-page'
import { SecurityPage } from '@/features/marketing/security-page'
import { ContactPage } from '@/features/marketing/contact-page'
import { PrivacyPage, RiskDisclosurePage, TermsPage } from '@/features/marketing/legal-page'
import { DownloadPage } from '@/features/marketing/download-page'
import { AdminWalletApkPage } from '@/features/admin/pages/admin-wallet-apk-page'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <PublicShell />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'about', element: <AboutPage /> },
      { path: 'token', element: <TokenPublicPage /> },
      { path: 'support', element: <SupportPublicPage /> },
      { path: 'security', element: <SecurityPage /> },
      { path: 'download', element: <DownloadPage /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 'legal/terms', element: <TermsPage /> },
      { path: 'legal/privacy', element: <PrivacyPage /> },
      { path: 'legal/risk', element: <RiskDisclosurePage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/register', element: <RegisterPage /> },
      { path: 'auth/wallet-register', element: <WalletRegisterPage /> },
      { path: 'auth/reset', element: <ResetPasswordPage /> },
    ],
  },
  {
    path: '/app',
    element: <ProtectedRoute />,
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
          { path: 'token', element: <AppTokenPage /> },
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
    children: [
      {
        element: <AppShell variant="admin" />,
        children: [
          { index: true, element: <AdminDashboardPage /> },
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
          { path: 'wallet-apk', element: <AdminWalletApkPage /> },
          { path: 'users', element: <AdminUsersPage /> },
          { path: 'affiliates', element: <AdminAffiliatesPage /> },
          { path: 'tickets', element: <AdminTicketsPage /> },
          { path: 'audit', element: <AdminAuditPage /> },
          { path: 'settings', element: <AdminSettingsPage /> },
          { path: 'plan', element: <AdminPlanPage /> },
          { path: 'withdraw', element: <AdminWithdrawSettingsPage /> },
        ],
      },
    ],
  },
])
