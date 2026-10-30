import { callFunction } from '@/services/api'

export interface FooterLink {
  label: string
  href: string
}

export interface FooterColumn {
  title: string
  links: FooterLink[]
}

export interface ContactSettings {
  companyName: string
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  region: string
  postalCode: string
  country: string
  supportHours: string
}

export interface FooterSettings {
  tagline: string
  copyright: string
  columns: FooterColumn[]
}

export interface PublicPlatformSettings {
  contact: ContactSettings
  footer: FooterSettings
  deposit: {
    minDepositUsdCents: number
  }
  token: {
    tokensPerUsd: number
    priceUsd: number
  }
  withdraw: {
    minWithdrawUsdCents: number
    commissionBps: number
    autoWithdrawEnabled: boolean
  }
  plan: Record<string, unknown>
  hotWalletPool: { multiWalletEnabled: boolean }
}

export async function getPublicPlatformSettings() {
  return callFunction<undefined, PublicPlatformSettings>('getPublicPlatformSettings')
}
