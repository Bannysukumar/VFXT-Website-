import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage'
import { callFunction } from '@/services/api'
import { getFirebaseStorage } from '@/lib/firebase'

export type WalletApkReleaseInfo =
  | { available: false }
  | {
      available: true
      versionName: string
      versionCode: number
      fileName: string
      downloadUrl: string
      sizeBytes: number
      notes: string
      sha256: string | null
      publishedAt: string | null
    }

export async function getWalletApkRelease() {
  return callFunction<undefined, WalletApkReleaseInfo>('getWalletApkRelease')
}

export type PublishWalletApkInput = {
  versionName: string
  versionCode: number
  fileName: string
  downloadUrl: string
  storagePath: string
  sizeBytes: number
  notes?: string
  sha256?: string
}

export async function publishWalletApk(input: PublishWalletApkInput) {
  return callFunction<
    PublishWalletApkInput,
    { ok: true; versionName: string; versionCode: number; downloadUrl: string }
  >('publishWalletApk', input)
}

export async function unpublishWalletApk() {
  return callFunction<undefined, { ok: true }>('unpublishWalletApk')
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '.')
}

/** Uploads an APK to public Storage and returns path + download URL. */
export function uploadWalletApk(
  file: File,
  versionName: string,
  onProgress?: (percent: number) => void,
): Promise<{ storagePath: string; downloadUrl: string; fileName: string }> {
  const safeVersion = sanitizeFileName(versionName || 'release')
  const fileName = `vfxt-wallet-${safeVersion}.apk`
  const storagePath = `public/wallet-apk/${fileName}`
  const storageRef = ref(getFirebaseStorage(), storagePath)

  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, {
      contentType: 'application/vnd.android.package-archive',
      customMetadata: {
        versionName,
        originalName: file.name,
      },
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

export function formatApkSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
