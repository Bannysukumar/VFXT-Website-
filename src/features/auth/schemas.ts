import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const optionalWallet = z
  .string()
  .trim()
  .optional()
  .transform((v) => v ?? '')
  .refine((v) => v === '' || /^0x[a-fA-F0-9]{40}$/.test(v), {
    message: 'Enter a valid BEP-20 address (0x…)',
  })

export const registerSchema = z
  .object({
    displayName: z.string().min(2, 'Name is required').max(80),
    email: z.string().email('Enter a valid email'),
    mobile: z
      .string()
      .min(8, 'Mobile number is required')
      .max(20)
      .regex(/^[+0-9][0-9\s\-()]{7,19}$/, 'Enter a valid mobile number'),
    referralCode: z
      .string()
      .min(4, 'Referral code is required')
      .max(32, 'Referral code is too long'),
    walletAddress: optionalWallet,
    password: z
      .string()
      .min(8, 'At least 8 characters')
      .regex(/[A-Z]/, 'Include an uppercase letter')
      .regex(/[a-z]/, 'Include a lowercase letter')
      .regex(/[0-9]/, 'Include a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

/** After wallet login — complete mandatory profile fields. */
export const walletCompleteSchema = z.object({
  displayName: z.string().min(2, 'Name is required').max(80),
  mobile: z
    .string()
    .min(8, 'Mobile number is required')
    .max(20)
    .regex(/^[+0-9][0-9\s\-()]{7,19}$/, 'Enter a valid mobile number'),
  referralCode: z.string().min(4, 'Referral code is required').max(32),
})

export const resetSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type WalletCompleteValues = z.infer<typeof walletCompleteSchema>
export type ResetValues = z.infer<typeof resetSchema>
