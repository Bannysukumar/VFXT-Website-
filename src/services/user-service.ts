import { updateProfile as updateAuthProfile } from 'firebase/auth'
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import { getDb, getFirebaseAuth, isFirebaseReady } from '@/lib/firebase'
import { ApiError, callFunction } from '@/services/api'

export type UpdateProfileInput = {
  displayName?: string
  photoURL?: string | null
  timezone?: string | null
  locale?: string | null
  preferences?: Record<string, unknown>
}

/**
 * Saves safe profile fields to Firestore (client rules allow these) and syncs
 * displayName to Firebase Auth. Does not depend on the updateProfile callable
 * (which can 401 when Cloud Run IAM is mis-set).
 */
export async function updateProfile(input: UpdateProfileInput) {
  if (!isFirebaseReady()) {
    throw new ApiError('Firebase is not configured', 'firebase/not-configured')
  }
  const auth = getFirebaseAuth()
  const user = auth.currentUser
  if (!user) {
    throw new ApiError('Not signed in', 'unauthenticated')
  }

  const patch: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  }
  if (input.displayName !== undefined) patch.displayName = input.displayName
  if (input.photoURL !== undefined) patch.photoURL = input.photoURL
  if (input.timezone !== undefined) patch.timezone = input.timezone
  if (input.locale !== undefined) patch.locale = input.locale
  if (input.preferences !== undefined) patch.preferences = input.preferences

  await updateDoc(doc(getDb(), 'users', user.uid), patch)

  if (input.displayName !== undefined) {
    await updateAuthProfile(user, { displayName: input.displayName })
  }

  // Best-effort server mirror (audit / legacy). Ignore IAM failures.
  try {
    await callFunction<UpdateProfileInput, { ok: true }>('updateProfile', input)
  } catch {
    /* Auth + Firestore already updated */
  }

  return { ok: true as const }
}
