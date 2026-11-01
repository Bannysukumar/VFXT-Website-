/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_MEASUREMENT_ID?: string
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string
  readonly VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?: string
  readonly VITE_USE_FIREBASE_EMULATORS?: string
  readonly VITE_FIREBASE_AUTH_EMULATOR_HOST?: string
  readonly VITE_FIREBASE_FIRESTORE_EMULATOR_HOST?: string
  readonly VITE_FIREBASE_FUNCTIONS_EMULATOR_HOST?: string
  readonly VITE_FIREBASE_STORAGE_EMULATOR_HOST?: string
  readonly VITE_FEATURE_STAKING_ENABLED?: string
  readonly VITE_FEATURE_SWAPS_ENABLED?: string
  readonly VITE_FEATURE_GAMING_ENABLED?: string
  readonly VITE_FEATURE_BLOCKCHAIN_ENABLED?: string
  readonly VITE_VFXT_TOKEN_SYMBOL?: string
  readonly VITE_VFXT_TOKEN_DECIMALS?: string
  readonly VITE_VFXT_CONTRACT_NAME?: string
  readonly VITE_VFXT_CHAIN_ID?: string
  readonly VITE_VFXT_CONTRACT_ADDRESS?: string
  readonly VITE_VFXT_TREASURY_ADDRESS?: string
  readonly VITE_VFXT_TOTAL_SUPPLY?: string
  readonly VITE_VFXT_SWAP_ADDRESS?: string
  readonly VITE_SUPPORT_EMAIL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
