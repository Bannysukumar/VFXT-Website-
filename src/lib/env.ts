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
  VITE_VFXT_CONTRACT_NAME: z.string().default('VFXT'),
  VITE_VFXT_CHAIN_ID: z.string().default('56'),
  VITE_VFXT_CONTRACT_ADDRESS: z
    .string()
    .default('0x4A08EF10e6f4aa077A74496793467d2192061969'),
  VITE_VFXT_TREASURY_ADDRESS: z
    .string()
    .default('0x76b16F59Cfab5DdaE5D149BE98E5d755F939572A'),
  VITE_VFXT_TOTAL_SUPPLY: z.string().default('10000000000000'),
  VITE_VFXT_SWAP_ADDRESS: z
    .string()
    .default('0xD0fe8d149D4Cb91Bc30036f8c0C799859C0A1F24'),
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
