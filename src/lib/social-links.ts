import type { LucideIcon } from 'lucide-react'
import {
  Facebook,
  Github,
  Globe,
  Instagram,
  Linkedin,
  MessageCircle,
  Music2,
  Send,
  Twitter,
  Youtube,
} from 'lucide-react'
import type { SocialPlatform } from '@/services/platform-service'

export const SOCIAL_PLATFORM_OPTIONS: Array<{
  id: SocialPlatform
  label: string
}> = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'twitter', label: 'X / Twitter' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'discord', label: 'Discord' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'github', label: 'GitHub' },
  { id: 'website', label: 'Website' },
  { id: 'other', label: 'Other' },
]

export const SOCIAL_ICONS: Record<SocialPlatform, LucideIcon> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
  linkedin: Linkedin,
  telegram: Send,
  whatsapp: MessageCircle,
  discord: MessageCircle,
  tiktok: Music2,
  github: Github,
  website: Globe,
  other: Globe,
}

export function socialLabel(platform: SocialPlatform, label?: string): string {
  const trimmed = label?.trim()
  if (trimmed) return trimmed
  return SOCIAL_PLATFORM_OPTIONS.find((o) => o.id === platform)?.label ?? 'Social'
}

export function newSocialId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `soc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
