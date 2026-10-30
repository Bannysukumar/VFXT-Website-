import { z } from 'zod';

export const currencySchema = z.enum(['USD', 'VFXT']);

export const createWithdrawalRequestSchema = z
  .object({
    currency: currencySchema.default('USD'),
    amountMinor: z.number().int().positive().optional(),
    amount: z.string().min(1).max(32).optional(),
    destination: z.string().trim().min(5).max(200),
    method: z.string().trim().min(1).max(64).default('manual'),
    note: z.string().trim().max(500).nullable().optional(),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict()
  .refine((v) => v.amountMinor != null || (v.amount != null && v.amount.length > 0), {
    message: 'amountMinor or amount is required',
  });

export const withdrawalIdSchema = z
  .object({
    withdrawalId: z.string().min(1).max(128),
  })
  .strict();

export const approveWithdrawalSchema = withdrawalIdSchema;

export const completeWithdrawalSchema = z
  .object({
    withdrawalId: z.string().min(1).max(128),
    idempotencyKey: z.string().min(8).max(128).optional(),
  })
  .strict();

export const rejectWithdrawalSchema = z
  .object({
    withdrawalId: z.string().min(1).max(128),
    reason: z.string().trim().min(1).max(500),
  })
  .strict();
