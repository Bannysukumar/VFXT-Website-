import { z } from 'zod';

export const currencySchema = z.enum(['USD', 'VFXT']);

export const createDepositRequestSchema = z
  .object({
    currency: currencySchema.default('USD'),
    /** Preferred: integer USD cents / VFXT tokens. */
    amountMinor: z.number().int().positive().optional(),
    /** Legacy: human-readable amount string. */
    amount: z.string().min(1).max(32).optional(),
    method: z.string().trim().min(1).max(64).default('manual'),
    reference: z.string().trim().max(128).nullable().optional(),
    note: z.string().trim().max(500).nullable().optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict()
  .refine((v) => v.amountMinor != null || (v.amount != null && v.amount.length > 0), {
    message: 'amountMinor or amount is required',
  });

export const approveDepositSchema = z
  .object({
    depositId: z.string().min(1).max(128),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict();

export const rejectDepositSchema = z
  .object({
    depositId: z.string().min(1).max(128),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
