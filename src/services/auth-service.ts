import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { getFirebaseAuth, isFirebaseReady } from '@/lib/firebase'
import { ApiError, callFunction } from '@/services/api'

function requireAuth() {
  if (!isFirebaseReady()) {
    throw new ApiError('Firebase is not configured', 'firebase/not-configured')
  }
  return getFirebaseAuth()
}

export async function lookupReferralCode(code: string) {
  return callFunction<
    { code: string },
    { ok: true; referralCode: string; displayName: string }
  >('lookupReferralCode', { code })
}

export async function finalizeRegistration(input: {
  referralCode: string
  mobile?: string
  displayName?: string
  walletAddress?: string
}) {
  return callFunction<
    {
      referralCode: string
      mobile?: string
      displayName?: string
      walletAddress?: string
    },
    { ok: true; referrerId: string; mobile: string | null; walletAddress: string | null }
  >('finalizeRegistration', {
    referralCode: input.referralCode,
    ...(input.mobile?.trim() ? { mobile: input.mobile.trim() } : {}),
    ...(input.displayName?.trim() ? { displayName: input.displayName.trim() } : {}),
    walletAddress: input.walletAddress || '',
  })
}

export async function registerWithEmail(input: {
  email: string
  password: string
  displayName: string
  mobile: string
  referralCode: string
  walletAddress?: string
}): Promise<User> {
  const auth = requireAuth()
  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password)
  await updateProfile(credential.user, { displayName: input.displayName })
  await sendEmailVerification(credential.user)

  // Wait briefly for onUserCreated to provision Firestore profile
  let lastErr: unknown
  for (let i = 0; i < 8; i += 1) {
    try {
      await finalizeRegistration({
        referralCode: input.referralCode,
        mobile: input.mobile,
        displayName: input.displayName,
        walletAddress: input.walletAddress,
      })
      lastErr = null
      break
    } catch (err) {
      lastErr = err
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  if (lastErr) throw lastErr

  return credential.user
}

function mapAuthError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('Sign-in failed')
  const code = 'code' in error && typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : ''
  if (code === 'auth/network-request-failed') {
    return new Error(
      'Could not reach Firebase Auth. Check your connection, disable ad-block/VPN for this site, then try again.',
    )
  }
  if (code === 'auth/unauthorized-domain') {
    return new Error(
      'This domain is not authorized for Firebase Auth. Add it under Authentication → Settings → Authorized domains.',
    )
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return new Error('Invalid email or password')
  }
  return error
}

async function withAuthRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let last: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn()
    } catch (error) {
      last = error
      const code =
        error && typeof error === 'object' && 'code' in error
          ? String((error as { code: unknown }).code)
          : ''
      if (code !== 'auth/network-request-failed' || i === attempts - 1) {
        throw mapAuthError(error)
      }
      await new Promise((r) => setTimeout(r, 400 * (i + 1)))
    }
  }
  throw mapAuthError(last)
}

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const auth = requireAuth()
  const credential = await withAuthRetry(() => signInWithEmailAndPassword(auth, email, password))
  return credential.user
}

export async function logout(): Promise<void> {
  const auth = requireAuth()
  await signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  const { callFunction } = await import('@/services/api')
  try {
    const result = await callFunction<{ email: string }, { ok: true; via: 'smtp' | 'client_fallback' }>(
      'requestPasswordReset',
      { email: email.trim().toLowerCase() },
    )
    if (result.via === 'smtp') return
  } catch {
    // Fall through to Firebase Auth email if the callable is unavailable.
  }
  const auth = requireAuth()
  await sendPasswordResetEmail(auth, email.trim().toLowerCase())
}

export async function resendVerification(): Promise<void> {
  const auth = requireAuth()
  if (!auth.currentUser) {
    throw new ApiError('Not signed in', 'auth/unauthenticated')
  }
  await sendEmailVerification(auth.currentUser)
}
