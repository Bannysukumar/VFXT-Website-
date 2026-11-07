import { httpsCallable, type HttpsCallableResult } from 'firebase/functions'
import { getFirebaseAuth, getFirebaseFunctions, isFirebaseReady } from '@/lib/firebase'

export class ApiError extends Error {
  code: string

  constructor(message: string, code = 'unknown') {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** Reload Auth user + force a fresh ID token (needed after email verify links). */
async function refreshAuthTokenIfNeeded() {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    if (!user) return
    if (!user.emailVerified) {
      await user.reload()
    }
    await user.getIdToken(true)
  } catch {
    /* callable will surface auth errors */
  }
}

export async function callFunction<TRequest, TResponse>(
  name: string,
  data?: TRequest,
): Promise<TResponse> {
  if (!isFirebaseReady()) {
    throw new ApiError(
      'Firebase is not configured. Set VITE_FIREBASE_* in .env.local or start the emulators.',
      'firebase/not-configured',
    )
  }

  try {
    await refreshAuthTokenIfNeeded()
    const callable = httpsCallable<TRequest, TResponse>(getFirebaseFunctions(), name)
    const result: HttpsCallableResult<TResponse> = await callable(data)
    return result.data
  } catch (error) {
    const err = error as {
      code?: string
      message?: string
      details?: { message?: string; code?: string }
      customData?: { message?: string }
    }
    const message =
      err.details?.message ||
      err.customData?.message ||
      err.message ||
      'Request failed'
    throw new ApiError(message, err.code ?? 'functions/unknown')
  }
}
