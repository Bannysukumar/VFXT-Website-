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
  mobile: string
  displayName?: string
  walletAddress?: string
}) {
  return callFunction<
    typeof input,
    { ok: true; referrerId: string; mobile: string; walletAddress: string | null }
  >('finalizeRegistration', {
    referralCode: input.referralCode,
    mobile: input.mobile,
    displayName: input.displayName,
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

export async function loginWithEmail(email: string, password: string): Promise<User> {
  const auth = requireAuth()
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logout(): Promise<void> {
  const auth = requireAuth()
  await signOut(auth)
}

export async function resetPassword(email: string): Promise<void> {
  const auth = requireAuth()
  await sendPasswordResetEmail(auth, email)
}

export async function resendVerification(): Promise<void> {
  const auth = requireAuth()
  if (!auth.currentUser) {
    throw new ApiError('Not signed in', 'auth/unauthenticated')
  }
  await sendEmailVerification(auth.currentUser)
}
