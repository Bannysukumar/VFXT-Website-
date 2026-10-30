import { z } from 'zod'

const envSchema = z.object({
  VITE_FIREBASE_API_KEY: z.string().min(1).optional(),
  VITE_FIREBASE_AUTH_DOMAIN: z.string().min(1).optional(),
  VITE_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  VITE_FIREBASE_STORAGE_BUCKET: z.string().min(1).optional(),
  VITE_FIREBASE_MESSAGING_SENDER_ID: z.string().min(1).optional(),
  VITE_FIREBASE_APP_ID: z.string().min(1).optional(),
  VITE_FIREBASE_MEASUREMENT_ID: z.string().optional(),
  VITE_FIREBASE_APPCHECK_SITE_KEY: z.string().optional(),
  VITE_FIREBASE_APPCHECK_DEBUG_TOKEN: z.string().optional(),
  VITE_USE_FIREBASE_EMULATORS: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  VITE_FIREBASE_AUTH_EMULATOR_HOST: z.string().default('127.0.0.1:9099'),
  VITE_FIREBASE_FIRESTORE_EMULATOR_HOST: z.string().default('127.0.0.1:8080'),
  VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST: z.string().default('127.0.0.1:5001'),
  VITE_FIREBASE_STORAGE_EMULATOR_HOST: z.string().default('127.0.0.1:9199'),
  VITE_FEATURE_STAKING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  VITE_FEATURE_SWAPS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  VITE_FEATURE_GAMING_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  VITE_FEATURE_BLOCKCHAIN_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  VITE_VFXT_TOKEN_SYMBOL: z.string().default('VFXT'),
  VITE_VFXT_TOKEN_DECIMALS: z.string().default('18'),
  VITE_VFXT_CHAIN_ID: z.string().optional(),
  VITE_VFXT_CONTRACT_ADDRESS: z.string().optional(),
  VITE_SUPPORT_EMAIL: z
    .string()
    .optional()
    .transform((v) => (v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : undefined)),
})

const parsed = envSchema.safeParse(import.meta.env)

if (!parsed.success) {
  console.error('Invalid environment configuration', parsed.error.flatten())
}

export const env = parsed.success
  ? parsed.data
  : envSchema.parse({
      VITE_USE_FIREBASE_EMULATORS: 'true',
    })

export function hasFirebaseConfig(): boolean {
  return Boolean(
    env.VITE_FIREBASE_API_KEY &&
      env.VITE_FIREBASE_AUTH_DOMAIN &&
      env.VITE_FIREBASE_PROJECT_ID &&
      env.VITE_FIREBASE_APP_ID,
  )
}
