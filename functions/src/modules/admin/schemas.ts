import { z } from 'zod';

export const listUsersSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional().default(50),
    startAfterUid: z.string().min(1).max(128).optional(),
  })
  .strict();

export const listPendingSchema = z
  .object({
    limit: z.number().int().min(1).max(100).optional().default(50),
  })
  .strict();
