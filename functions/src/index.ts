import { initAdmin } from './lib/firebase';

// Initialize Admin SDK on cold start.
initAdmin();

// Auth trigger (v1)
export { onUserCreated } from './modules/auth/handlers';

// Users
export { updateProfile } from './modules/users/handlers';

// Authorization
export {
  setAdminRole,
  bootstrapFirstAdmin,
} from './modules/authorization/handlers';

// Deposits
export {
  createDepositRequest,
  approveDeposit,
  rejectDeposit,
} from './modules/deposits/handlers';

// Withdrawals
export {
  createWithdrawalRequest,
  approveWithdrawal,
  completeWithdrawal,
  rejectWithdrawal,
} from './modules/withdrawals/handlers';

// Token
export { getTokenConfig } from './modules/token/handlers';

// Wallets
export {
  ensureWallets,
  transferBetweenWallets,
} from './modules/wallets/handlers';

// Referrals / affiliate
export {
  applyReferralCode,
  listReferrals,
  getAffiliateDashboard,
} from './modules/referrals/handlers';

// Staking
export {
  getStakingPlans,
  getStakingConfigs,
  createStakingPosition,
  getMyPositions,
  getMyStakingPositions,
  processDailyYields,
  processLockedMaturities,
} from './modules/staking/handlers';

// Ranks
export {
  getRankStatus,
  processRankRewards,
} from './modules/ranks/handlers';

// Support
export {
  createTicket,
  addMessage,
  updateTicketStatus,
} from './modules/support/handlers';

// Admin
export {
  listUsers,
  listPendingDeposits,
  listPendingWithdrawals,
  getPlatformStats,
} from './modules/admin/handlers';

export {
  getAdminUserDetail,
  adminUpdateUser,
  adminAdjustWallet,
  impersonateUser,
} from './modules/admin/user-mgmt';

// Platform settings (plans, contact, footer, withdraw rules)
export {
  getPublicPlatformSettings,
  getAdminPlatformSettings,
  updatePlatformSettings,
} from './modules/platform/handlers';

// Crypto USDT BEP-20 (deposits QR / auto-credit, withdrawals, admin hot wallet)
export {
  getCryptoWalletInfo,
  getAdminCryptoWalletInfo,
  setCryptoHotWallet,
  checkDepositPayment,
  monitorCryptoDeposits,
  listCryptoHotWallets,
  addCryptoHotWallet,
  updateCryptoHotWallet,
  removeCryptoHotWallet,
} from './modules/crypto/handlers';

export { processAutoWithdrawals } from './modules/withdrawals/auto-withdraw';
