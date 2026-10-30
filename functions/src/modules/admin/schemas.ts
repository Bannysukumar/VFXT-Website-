import { z } from 'zod';

export const listUsersSchema = z
  .object({
    limit: z.number().int().min(1).max(200).optional().default(50),
    startAfterUid: z.string().min(1).max(128).optional(),
    status: z.enum(['active', 'suspended', 'closed', 'pending_verification']).optional(),
    kycStatus: z.enum(['none', 'pending', 'verified', 'rejected']).optional(),
  })
  .strict();

export const listPendingSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional().default(50),
  })
  .strict();
