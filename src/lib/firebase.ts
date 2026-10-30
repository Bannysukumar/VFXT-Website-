import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  browserSessionPersistence,
  connectAuthEmulator,
  getAuth,
  setPersistence,
  type Auth,
} from 'firebase/auth'
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore'
import { connectFunctionsEmulator, getFunctions, type Functions } from 'firebase/functions'
import { connectStorageEmulator, getStorage, type FirebaseStorage } from 'firebase/storage'
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check'
import { env, hasFirebaseConfig } from '@/lib/env'

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let functions: Functions | null = null
let storage: FirebaseStorage | null = null
let appCheck: AppCheck | null = null
let emulatorsConnected = false

export function getFirebaseApp(): FirebaseApp {
  if (!hasFirebaseConfig()) {
    throw new Error(
      'Firebase is not configured. Copy .env.example to .env.local and set VITE_FIREBASE_* values.',
    )
  }

  if (!app) {
    app =
      getApps()[0] ??
      initializeApp({
        apiKey: env.VITE_FIREBASE_API_KEY,
        authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
        projectId: env.VITE_FIREBASE_PROJECT_ID,
        storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
        appId: env.VITE_FIREBASE_APP_ID,
        measurementId: env.VITE_FIREBASE_MEASUREMENT_ID,
      })
  }

  return app
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp())
  }
  return auth
}

export function getDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp())
  }
  return db
}

export function getFirebaseFunctions(): Functions {
  if (!functions) {
    functions = getFunctions(getFirebaseApp(), 'us-central1')
  }
  return functions
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp())
  }
  return storage
}

export function initAppCheck(): AppCheck | null {
  if (appCheck) return appCheck
  if (!hasFirebaseConfig()) return null

  if (import.meta.env.DEV && env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN) {
    // Debug provider only for local development
    ;(
      globalThis as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
  }

  if (!env.VITE_FIREBASE_APPCHECK_SITE_KEY) {
    return null
  }

  appCheck = initializeAppCheck(getFirebaseApp(), {
    provider: new ReCaptchaV3Provider(env.VITE_FIREBASE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })

  return appCheck
}

export async function connectEmulatorsIfNeeded(): Promise<void> {
  if (emulatorsConnected || !env.VITE_USE_FIREBASE_EMULATORS || !hasFirebaseConfig()) {
    return
  }

  const authInstance = getFirebaseAuth()
  const dbInstance = getDb()
  const functionsInstance = getFirebaseFunctions()
  const storageInstance = getFirebaseStorage()

  connectAuthEmulator(authInstance, `http://${env.VITE_FIREBASE_AUTH_EMULATOR_HOST}`, {
    disableWarnings: true,
  })
  // IndexedDB multi-tab locks hang emulator sign-in; sessionStorage survives same-tab reloads.
  await setPersistence(authInstance, browserSessionPersistence)

  const [fsHost, fsPort] = env.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(dbInstance, fsHost, Number(fsPort))

  const [fnHost, fnPort] = env.VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST.split(':')
  connectFunctionsEmulator(functionsInstance, fnHost, Number(fnPort))

  const [stHost, stPort] = env.VITE_FIREBASE_STORAGE_EMULATOR_HOST.split(':')
  connectStorageEmulator(storageInstance, stHost, Number(stPort))

  emulatorsConnected = true
}

export function isFirebaseReady(): boolean {
  return hasFirebaseConfig()
}
