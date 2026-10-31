import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    photoURL: z.string().url().max(500).nullable().optional(),
    timezone: z.string().trim().min(1).max(64).nullable().optional(),
    locale: z.string().trim().min(2).max(16).nullable().optional(),
    preferences: z.record(z.unknown()).optional(),
    // withdrawalAddress is admin-only after first successful withdrawal.
  })
  .strict()
  .refine(
    (v) => Object.keys(v).length > 0,
    { message: 'At least one field is required' },
  );

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
