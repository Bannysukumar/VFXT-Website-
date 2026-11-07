import { callFunction } from '@/services/api'

export type WalletKindName =
  | 'fund'
  | 'staking'
  | 'daily_roi'
  | 'level_income'
  | 'direct_referral'
  | 'withdrawal'
  | 'vfxt'

export type TransferRouteSetting = {
  from: WalletKindName
  to: WalletKindName
  enabled: boolean
}

export type PeerWalletSetting = {
  kind: WalletKindName
  enabled: boolean
}

export type AdminTransferSettings = {
  enabled: boolean
  internalEnabled: boolean
  peerEnabled: boolean
  internalRoutes: TransferRouteSetting[]
  peerWallets: PeerWalletSetting[]
  walletKinds: WalletKindName[]
  updatedAt: string | null
}

export type MyTransferSettings = {
  enabled: boolean
  internalEnabled: boolean
  peerEnabled: boolean
  internalRoutes: TransferRouteSetting[]
  peerWallets: WalletKindName[]
}

export async function getMyTransferSettings() {
  return callFunction<undefined, MyTransferSettings>('getMyTransferSettings')
}

export async function getAdminTransferSettings() {
  return callFunction<undefined, { settings: AdminTransferSettings }>('getAdminTransferSettings')
}

export async function updateAdminTransferSettings(
  input: Partial<{
    enabled: boolean
    internalEnabled: boolean
    peerEnabled: boolean
    internalRoutes: TransferRouteSetting[]
    peerWallets: PeerWalletSetting[]
  }>,
) {
  return callFunction<typeof input, { ok: true; settings: AdminTransferSettings }>(
    'updateAdminTransferSettings',
    input,
  )
}
