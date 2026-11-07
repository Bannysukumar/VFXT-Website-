import { z } from 'zod';

/** Schema accepts any wallet kind; admin transfer settings decide what is allowed. */
export const transferToUserSchema = z
  .object({
    toUserId: z.string().min(4).max(32),
    walletKind: z.enum([
      'fund',
      'staking',
      'daily_roi',
      'level_income',
      'direct_referral',
      'withdrawal',
      'vfxt',
    ]),
    amountMinor: z.number().int().positive(),
    // Firebase callables often encode missing optionals as null (not undefined).
    note: z.string().trim().max(200).nullable().optional(),
    idempotencyKey: z.string().min(8).max(128),
  })
  .strict();

export type TransferToUserInput = z.infer<typeof transferToUserSchema>;
