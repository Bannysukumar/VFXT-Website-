import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { AppError } from '../../lib/errors';
import { AdminRole, requireAdminRole, requireAuth } from '../../lib/permissions';
import { writeAuditLog } from '../audit/handlers';
import { getPlatformSettings, savePlatformSettings } from './store';

const footerLinkSchema = z.object({
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(300),
});

const socialPlatformSchema = z.enum([
  'facebook',
  'instagram',
  'twitter',
  'youtube',
  'linkedin',
  'telegram',
  'whatsapp',
  'discord',
  'tiktok',
  'github',
  'website',
  'other',
]);

const socialLinkSchema = z.object({
  id: z.string().min(1).max(64),
  platform: socialPlatformSchema,
  label: z.string().max(80),
  url: z
    .string()
    .min(4)
    .max(500)
    .refine(
      (v) =>
        /^https?:\/\//i.test(v.trim()) ||
        /^mailto:/i.test(v.trim()) ||
        /^tg:/i.test(v.trim()),
      { message: 'Social URL must start with https:// (or mailto: / tg:)' },
    ),
  visible: z.boolean(),
});

const platformPatchSchema = z
  .object({
    contact: z
      .object({
        companyName: z.string().max(120).optional(),
        email: z.string().email().max(200).optional(),
        phone: z.string().max(40).optional(),
        addressLine1: z.string().max(200).optional(),
        addressLine2: z.string().max(200).optional(),
        city: z.string().max(100).optional(),
        region: z.string().max(100).optional(),
        postalCode: z.string().max(40).optional(),
        country: z.string().max(100).optional(),
        supportHours: z.string().max(200).optional(),
      })
      .optional(),
    footer: z
      .object({
        tagline: z.string().max(300).optional(),
        copyright: z.string().max(200).optional(),
        columns: z
          .array(
            z.object({
              title: z.string().min(1).max(80),
              links: z.array(footerLinkSchema).max(12),
            }),
          )
          .max(6)
          .optional(),
        socials: z.array(socialLinkSchema).max(24).optional(),
      })
      .optional(),
    plan: z
      .object({
        minStakeUsdCents: z.number().int().positive().optional(),
        dailyRateBps: z.number().int().min(1).max(10_000).optional(),
        maxDays: z.number().int().min(1).max(3650).optional(),
        nonWorkingCapX: z.number().min(1).max(20).optional(),
        workingCapX: z.number().min(1).max(20).optional(),
        levelCommissionBps: z.array(z.number().int().min(0).max(10_000)).max(20).optional(),
        directReferralBonusBps: z.number().int().min(0).max(10_000).optional(),
        lockedPackages: z
          .array(
            z.object({
              id: z.string().min(1).max(64),
              days: z.number().int().positive(),
              multiplier: z.number().positive(),
              bonusTokenPct: z.number().min(0),
              label: z.string().min(1).max(80),
              enabled: z.boolean(),
            }),
          )
          .max(20)
          .optional(),
        rankRewards: z
          .array(
            z.object({
              rank: z.number().int().min(1).max(50),
              leftUsd: z.number().min(0),
              rightUsd: z.number().min(0),
              rewardUsd: z.number().min(0),
              cycleDays: z.number().int().positive(),
              enabled: z.boolean(),
            }),
          )
          .max(50)
          .optional(),
      })
      .optional(),
    deposit: z
      .object({
        minDepositUsdCents: z.number().int().positive().optional(),
        minVfxtDepositTokens: z.number().int().positive().max(1_000_000_000_000).optional(),
      })
      .optional(),
    token: z
      .object({
        /** Whole VFXT per $1 USDT. */
        tokensPerUsd: z.number().int().positive().max(1_000_000_000).optional(),
      })
      .optional(),
    withdraw: z
      .object({
        minWithdrawUsdCents: z.number().int().positive().optional(),
        commissionBps: z.number().int().min(0).max(10_000).optional(),
        autoWithdrawEnabled: z.boolean().optional(),
        requireProfileAddress: z.boolean().optional(),
      })
      .optional(),
    hotWalletPool: z
      .object({
        multiWalletEnabled: z.boolean().optional(),
      })
      .optional(),
  })
  .strict();

/** Public + authenticated: contact/footer/withdraw mins (no secrets). */
export const getPublicPlatformSettings = onCall(CALLABLE_OPTS, async () => {
  try {
    const s = await getPlatformSettings();
    return {
      contact: s.contact,
      footer: s.footer,
      deposit: {
        minDepositUsdCents: s.deposit.minDepositUsdCents,
        minVfxtDepositTokens: s.deposit.minVfxtDepositTokens,
      },
      token: {
        tokensPerUsd: s.token.tokensPerUsd,
        /** Convenience: USD price of 1 VFXT. */
        priceUsd: 1 / s.token.tokensPerUsd,
      },
      withdraw: {
        minWithdrawUsdCents: s.withdraw.minWithdrawUsdCents,
        commissionBps: s.withdraw.commissionBps,
        autoWithdrawEnabled: s.withdraw.autoWithdrawEnabled,
      },
      plan: s.plan,
      hotWalletPool: { multiWalletEnabled: s.hotWalletPool.multiWalletEnabled },
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const getAdminPlatformSettings = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.FinanceAdmin,
    ]);
    return await getPlatformSettings();
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const updatePlatformSettings = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin, AdminRole.OperationsAdmin]);
    const parsed = platformPatchSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid settings');
    }
    const next = await savePlatformSettings(
      parsed.data as Parameters<typeof savePlatformSettings>[0],
      ctx.uid,
    );
    await writeAuditLog({
      actorId: ctx.uid,
      action: 'platform.settings.update',
      resourceType: 'config',
      resourceId: 'platform',
      metadata: { keys: Object.keys(parsed.data) },
    });
    return next;
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Keep auth import used for future gated reads. */
void requireAuth;
