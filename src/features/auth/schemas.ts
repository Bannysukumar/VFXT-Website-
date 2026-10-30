import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
    walletAddress: z
      .string()
      .trim()
      .refine((v) => v === '' || /^0x[a-fA-F0-9]{40}$/.test(v), {
        message: 'Enter a valid BEP-20 address (0x…)',
      }),
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

/** After wallet login — referral is mandatory; name/mobile optional. */
export const walletCompleteSchema = z.object({
  displayName: z.string().max(80).optional().or(z.literal('')),
  mobile: z
    .string()
    .max(20)
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || v.trim() === '' || /^[+0-9][0-9\s\-()]{7,19}$/.test(v), {
      message: 'Enter a valid mobile number',
    }),
  referralCode: z.string().min(4, 'Referral code is required').max(32),
})

/**
 * Wallet connect signup — referral required; email/password optional (skippable).
 */
export const walletSignupSchema = z
  .object({
    displayName: z.string().max(80).optional().or(z.literal('')),
    mobile: z
      .string()
      .max(20)
      .optional()
      .or(z.literal(''))
      .refine((v) => !v || v.trim() === '' || /^[+0-9][0-9\s\-()]{7,19}$/.test(v), {
        message: 'Enter a valid mobile number',
      }),
    referralCode: z
      .string()
      .min(4, 'Referral code is required')
      .max(32, 'Referral code is too long'),
    email: z.string().optional().or(z.literal('')),
    password: z.string().optional().or(z.literal('')),
    confirmPassword: z.string().optional().or(z.literal('')),
    includeCredentials: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!data.includeCredentials) return
    const email = data.email?.trim() ?? ''
    if (!email || !z.string().email().safeParse(email).success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid email',
        path: ['email'],
      })
    }
    const password = data.password ?? ''
    if (password.length < 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least 8 characters',
        path: ['password'],
      })
    } else {
      if (!/[A-Z]/.test(password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Include an uppercase letter',
          path: ['password'],
        })
      }
      if (!/[a-z]/.test(password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Include a lowercase letter',
          path: ['password'],
        })
      }
      if (!/[0-9]/.test(password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Include a number',
          path: ['password'],
        })
      }
    }
    if (password !== (data.confirmPassword ?? '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      })
    }
  })

export const resetSchema = z.object({
  email: z.string().email('Enter a valid email'),
})

export type LoginValues = z.infer<typeof loginSchema>
export type RegisterValues = z.infer<typeof registerSchema>
export type WalletCompleteValues = z.infer<typeof walletCompleteSchema>
export type WalletSignupValues = z.infer<typeof walletSignupSchema>
export type ResetValues = z.infer<typeof resetSchema>
