import { z } from 'zod';

export const applyReferralCodeSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(4)
      .max(32)
      .regex(/^[A-Za-z0-9_-]+$/, 'Invalid referral code format'),
  })
  .strict();

export const listReferralsSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional().default(50),
  })
  .strict();

export const affiliateLevelSchema = z
  .object({
    level: z.number().int().min(1).max(7),
    limit: z.number().int().min(1).max(200).optional().default(100),
  })
  .strict();

export type ApplyReferralCodeInput = z.infer<typeof applyReferralCodeSchema>;
