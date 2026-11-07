import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { callFunction } from '@/services/api'
import { getFirebaseStorage } from '@/lib/firebase'

export type CampaignTier = {
  id: string
  name: string
  targetUsdCents: number
  nightsLabel: string
  sortOrder: number
}

export type CampaignSettings = {
  enabled: boolean
  title: string
  subtitle: string
  bannerUrl: string | null
  storagePath: string | null
  startsAt: string | null
  endsAt: string | null
  maxShows: number
  requiredDirectReferrals: number
  volumeSource: 'deposits' | 'staking' | 'deposits_and_staking'
  tiers: CampaignTier[]
  live: boolean
}

export type MyCampaignResponse = {
  active: boolean
  showBanner: boolean
  campaign: CampaignSettings
  progress: {
    volumeUsdCents: number
    directReferrals: number
    referralsMet: boolean
    requiredDirectReferrals: number
    achievedTierIds: string[]
    highestTierId: string | null
    nextTierId: string | null
    nextTierRemainingCents: number | null
    status: 'not_started' | 'in_progress' | 'achieved'
    views: number
    maxShows: number
  } | null
  tiers?: Array<CampaignTier & { achieved: boolean; progressPct: number }>
}

export type AdminCampaignStats = {
  campaign: CampaignSettings
  totals: {
    trackedUsers: number
    achieved: number
    inProgress: number
    pending: number
    notStarted: number
  }
  tiers: Array<{
    id: string
    name: string
    targetUsdCents: number
    achieved: number
    inProgressToward: number
  }>
  topAchievers: Array<{
    userId: string
    referralCode: string
    displayName: string | null
    highestTierId: string | null
    volumeUsdCents: number
    directReferrals: number
  }>
  refreshedAt: string
}

export async function getMyCampaign() {
  return callFunction<undefined, MyCampaignResponse>('getMyCampaign')
}

export async function getAdminCampaign() {
  return callFunction<
    undefined,
    { campaign: CampaignSettings; defaults: { tiers: CampaignTier[]; bannerUrl: string } }
  >('getAdminCampaign')
}

export type UpdateCampaignInput = Partial<{
  enabled: boolean
  title: string
  subtitle: string
  bannerUrl: string | null
  storagePath: string | null
  startsAt: string | null
  endsAt: string | null
  maxShows: number
  requiredDirectReferrals: number
  volumeSource: 'deposits' | 'staking' | 'deposits_and_staking'
  tiers: CampaignTier[]
}>

export async function updateAdminCampaign(input: UpdateCampaignInput) {
  return callFunction<UpdateCampaignInput, { ok: true; campaign: CampaignSettings }>(
    'updateAdminCampaign',
    input,
  )
}

export async function getAdminCampaignStats() {
  return callFunction<undefined, AdminCampaignStats>('getAdminCampaignStats')
}

export async function seedAdminCampaignDefaults() {
  return callFunction<undefined, { ok: true; seeded: boolean; campaign: CampaignSettings }>(
    'seedAdminCampaignDefaults',
  )
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.')
}

/** Upload a campaign banner image to public Storage. */
export function uploadCampaignBanner(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string; fileName: string }> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const fileName = `banner-${Date.now()}-${sanitizeFileName(file.name.replace(/\.[^.]+$/, ''))}.${ext}`
  const storagePath = `public/campaign-banners/${fileName}`
  const storageRef = ref(getFirebaseStorage(), storagePath)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: file.type || 'image/jpeg',
      customMetadata: { originalName: file.name },
    })
    task.on(
      'state_changed',
      (snap) => {
        if (!onProgress || snap.totalBytes <= 0) return
        onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100))
      },
      (error) => reject(error),
      async () => {
        try {
          const downloadUrl = await getDownloadURL(task.snapshot.ref)
          resolve({ storagePath, downloadUrl, fileName })
        } catch (err) {
          reject(err)
        }
      },
    )
  })
}
