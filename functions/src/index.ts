import { initAdmin } from './lib/firebase';

// Initialize Admin SDK on cold start.
initAdmin();

// Auth trigger (v1)
export { onUserCreated } from './modules/auth/handlers';
export { finalizeRegistration } from './modules/auth/registration';
export {
  getWalletLoginNonce,
  verifyWalletLogin,
  completeWalletSignup,
} from './modules/auth/wallet-login';

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
export {
  transferToUser,
  lookupUserId,
} from './modules/wallets/peer-transfer';

// Referrals / affiliate
export {
  applyReferralCode,
  listReferrals,
  getAffiliateDashboard,
  getAffiliateLevelMembers,
} from './modules/referrals/handlers';
export { lookupReferralCode } from './modules/referrals/lookup';

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
  adminListAutoDeposits,
  adminListAutoWithdrawals,
  adminListIncomeByType,
  adminListPeerTransfers,
} from './modules/admin/history';

export {
  getAdminUserDetail,
  adminUpdateUser,
  adminAdjustWallet,
  adminSetUserCredentials,
  impersonateUser,
} from './modules/admin/user-mgmt';

// Platform settings (plans, contact, footer, withdraw rules)
export {
  getPublicPlatformSettings,
  getAdminPlatformSettings,
  updatePlatformSettings,
} from './modules/platform/handlers';

export {
  getWalletApkRelease,
  publishWalletApk,
  unpublishWalletApk,
} from './modules/platform/wallet-apk';

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

// VFXT Wallet Android — mining / rewards (server-authoritative)
export {
  getWalletAppNonce,
  verifyWalletAppLogin,
} from './modules/mining/wallet-app-auth';
export {
  getMiningConfigPublic,
  miningStatus,
  miningStart,
  miningStop,
  miningHistory,
  rewardsClaim,
  rewardsClaims,
  adminGetMiningConfig,
  adminUpdateMiningConfig,
  adminUpdateClaim,
  adminListMiningClaims,
  adminMiningDashboardStats,
} from './modules/mining/handlers';
export {
  listMiningBoosters,
  purchaseMiningBooster,
  confirmMiningBoosterPayment,
  adminUpsertMiningBooster,
  adminDeleteMiningBooster,
  adminSetBoosterPaymentWallet,
  adminListBoosterHistory,
  adminListActiveUserBoosters,
  adminGetBoosterStats,
} from './modules/mining/booster-handlers';
