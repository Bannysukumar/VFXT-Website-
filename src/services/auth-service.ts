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
import { ApiError } from '@/services/api'

function requireAuth() {
  if (!isFirebaseReady()) {
    throw new ApiError('Firebase is not configured', 'firebase/not-configured')
  }
  return getFirebaseAuth()
}

export async function registerWithEmail(input: {
  email: string
  password: string
  displayName: string
}): Promise<User> {
  const auth = requireAuth()
  const credential = await createUserWithEmailAndPassword(auth, input.email, input.password)
  await updateProfile(credential.user, { displayName: input.displayName })
  await sendEmailVerification(credential.user)
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
