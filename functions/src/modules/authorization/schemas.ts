import { z } from 'zod';
import { AdminRole } from '../../lib/permissions';

export const adminRoleSchema = z.nativeEnum(AdminRole);

export const setAdminRoleSchema = z
  .object({
    uid: z.string().min(1).max(128),
    adminRole: adminRoleSchema.nullable(),
  })
  .strict();

export const bootstrapFirstAdminSchema = z
  .object({
    secret: z.string().min(16).max(256).optional(),
    bootstrapSecret: z.string().min(16).max(256).optional(),
  })
  .strict()
  .refine((v) => Boolean(v.secret || v.bootstrapSecret), {
    message: 'secret is required',
  });

export type SetAdminRoleInput = z.infer<typeof setAdminRoleSchema>;
export type BootstrapFirstAdminInput = z.infer<typeof bootstrapFirstAdminSchema>;
