import { callFunction } from '@/services/api'

export type UpdateProfileInput = {
  displayName?: string
  photoURL?: string | null
  timezone?: string | null
  locale?: string | null
  preferences?: Record<string, unknown>
  withdrawalAddress?: string | null
}

export async function updateProfile(input: UpdateProfileInput) {
  return callFunction<UpdateProfileInput, { ok: true }>('updateProfile', input)
}
