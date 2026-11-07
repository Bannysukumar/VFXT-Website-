import { onCall } from 'firebase-functions/v2/https';
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { AppError } from '../../lib/errors';
import { Collections, getDb } from '../../lib/firebase';
import { AdminRole, requireAdminRole, requireAuth } from '../../lib/permissions';
import { writeAuditLog } from '../audit/handlers';
import { requireActiveMember } from '../auth/helpers';
import {
  buildUserProgress,
  isCampaignLive,
  normalizeCampaign,
  readCampaignConfig,
  serializeCampaign,
  shouldShowBanner,
  writeCampaignConfig,
} from './store';
import {
  CAMPAIGN_PROGRESS,
  DEFAULT_CAMPAIGN_TIERS,
  type DashboardCampaignConfig,
} from './types';

const tierSchema = z.object({
  id: z.string().min(1).max(40),
  name: z.string().min(1).max(80),
  targetUsdCents: z.number().int().positive().max(100_000_000),
  nightsLabel: z.string().max(80).default(''),
  sortOrder: z.number().int().min(0).max(100).default(0),
});

const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    title: z.string().min(1).max(120).optional(),
    subtitle: z.string().max(200).optional(),
    bannerUrl: z
      .string()
      .max(2000)
      .nullable()
      .optional()
      .or(z.literal(''))
      .refine(
        (v) =>
          v == null ||
          v === '' ||
          v.startsWith('/') ||
          v.startsWith('https://') ||
          v.startsWith('http://'),
        'bannerUrl must be a path or http(s) URL',
      ),
    storagePath: z
      .string()
      .max(500)
      .nullable()
      .optional()
      .refine(
        (v) =>
          v == null ||
          v === '' ||
          /^public\/campaign-banners\/.+/i.test(v),
        'storagePath must be under public/campaign-banners/',
      ),
    startsAt: z.string().min(1).max(40).nullable().optional(),
    endsAt: z.string().min(1).max(40).nullable().optional(),
    maxShows: z.number().int().min(0).max(10_000).optional(),
    requiredDirectReferrals: z.number().int().min(0).max(100).optional(),
    volumeSource: z
      .enum(['deposits', 'staking', 'deposits_and_staking'])
      .optional(),
    tiers: z.array(tierSchema).min(1).max(12).optional(),
  })
  .strict();

function parseOptionalDate(iso: string | null | undefined): Timestamp | null | undefined {
  if (iso === undefined) return undefined;
  if (iso === null || iso === '') return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) {
    throw new AppError('invalid-argument', 'Invalid campaign date');
  }
  return Timestamp.fromMillis(ms);
}

/** Member: campaign banner + personal progress (increments view when shown). */
export const getMyCampaign = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAuth(request);
    await requireActiveMember(ctx.uid);
    const cfg = await readCampaignConfig();
    const live = isCampaignLive(cfg);

    if (!live) {
      return {
        active: false as const,
        showBanner: false as const,
        campaign: serializeCampaign(cfg),
        progress: null,
      };
    }

    // Peek views before increment so maxShows is enforced correctly.
    const { getUserViews } = await import('./store');
    const viewsBefore = await getUserViews(ctx.uid);
    const showBanner = shouldShowBanner(cfg, viewsBefore);
    const progress = await buildUserProgress(ctx.uid, cfg, { incrementView: showBanner });

    return {
      active: true as const,
      showBanner,
      campaign: serializeCampaign(cfg),
      progress: {
        volumeUsdCents: progress.volumeUsdCents,
        directReferrals: progress.directReferrals,
        referralsMet: progress.referralsMet,
        requiredDirectReferrals: cfg.requiredDirectReferrals,
        achievedTierIds: progress.achievedTierIds,
        highestTierId: progress.highestTierId,
        nextTierId: progress.nextTierId,
        nextTierRemainingCents: progress.nextTierRemainingCents,
        status: progress.status,
        views: progress.views,
        maxShows: cfg.maxShows,
      },
      tiers: cfg.tiers.map((t) => ({
        ...t,
        achieved: progress.achievedTierIds.includes(t.id),
        progressPct: Math.min(100, Math.floor((progress.volumeUsdCents / Math.max(1, t.targetUsdCents)) * 100)),
      })),
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Admin: full campaign settings. */
export const getAdminCampaign = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.FinanceAdmin,
      AdminRole.ReadonlyAdmin,
    ]);
    const cfg = await readCampaignConfig();
    return {
      campaign: serializeCampaign(cfg),
      defaults: {
        tiers: DEFAULT_CAMPAIGN_TIERS,
        bannerUrl: '/campaign-banner.jpg',
      },
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Admin: update enable/period/maxShows/banner/tiers. */
export const updateAdminCampaign = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const admin = requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.FinanceAdmin,
    ]);
    const parsed = updateSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError(
        'invalid-argument',
        parsed.error.issues[0]?.message ?? 'Invalid campaign settings',
      );
    }

    const current = await readCampaignConfig();
    const patch = parsed.data;
    const startsAt = parseOptionalDate(patch.startsAt);
    const endsAt = parseOptionalDate(patch.endsAt);

    let bannerUrl = current.bannerUrl;
    if (patch.bannerUrl !== undefined) {
      bannerUrl = patch.bannerUrl === '' ? null : patch.bannerUrl;
    }
    let storagePath = current.storagePath;
    if (patch.storagePath !== undefined) {
      storagePath = patch.storagePath === '' ? null : patch.storagePath;
    }

    const next: DashboardCampaignConfig = normalizeCampaign({
      ...current,
      ...patch,
      bannerUrl,
      storagePath,
      startsAt: startsAt === undefined ? current.startsAt : startsAt,
      endsAt: endsAt === undefined ? current.endsAt : endsAt,
      tiers: patch.tiers ?? current.tiers,
    });

    if (
      next.startsAt &&
      next.endsAt &&
      toComparable(next.startsAt) != null &&
      toComparable(next.endsAt) != null &&
      toComparable(next.startsAt)! > toComparable(next.endsAt)!
    ) {
      throw new AppError('invalid-argument', 'Campaign start must be before end');
    }

    const saved = await writeCampaignConfig(next, admin.uid);
    await writeAuditLog({
      actorId: admin.uid,
      action: 'campaign.update',
      resourceType: 'config',
      resourceId: 'dashboardCampaign',
      metadata: {
        enabled: saved.enabled,
        maxShows: saved.maxShows,
        bannerUrl: saved.bannerUrl,
      },
    });

    return { ok: true as const, campaign: serializeCampaign(saved) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

function toComparable(value: unknown): number | null {
  if (value == null) return null;
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  return null;
}

/**
 * Admin: counts of users who achieved each tier / still in progress / not started.
 * Uses cached campaignProgress docs (refreshed when members open the dashboard).
 */
export const getAdminCampaignStats = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.FinanceAdmin,
      AdminRole.ReadonlyAdmin,
    ]);
    const cfg = await readCampaignConfig();
    const db = getDb();
    const snap = await db.collection(CAMPAIGN_PROGRESS).limit(5000).get();

    const tierStats = cfg.tiers.map((t) => ({
      id: t.id,
      name: t.name,
      targetUsdCents: t.targetUsdCents,
      achieved: 0,
      inProgressToward: 0,
    }));

    let achievedAny = 0;
    let inProgress = 0;
    let notStarted = 0;
    const recentAchievers: Array<{
      userId: string;
      highestTierId: string | null;
      volumeUsdCents: number;
      directReferrals: number;
    }> = [];

    for (const doc of snap.docs) {
      const d = doc.data();
      const status = String(d.status || 'not_started');
      const achievedIds = Array.isArray(d.achievedTierIds)
        ? d.achievedTierIds.map(String)
        : [];
      const volume = Math.floor(Number(d.volumeUsdCents) || 0);

      if (status === 'achieved' || achievedIds.length > 0) {
        achievedAny += 1;
        recentAchievers.push({
          userId: doc.id,
          highestTierId: d.highestTierId ? String(d.highestTierId) : null,
          volumeUsdCents: volume,
          directReferrals: Math.floor(Number(d.directReferrals) || 0),
        });
      } else if (status === 'in_progress') {
        inProgress += 1;
      } else {
        notStarted += 1;
      }

      for (const tier of tierStats) {
        if (achievedIds.includes(tier.id)) {
          tier.achieved += 1;
        } else if (volume > 0 && volume < tier.targetUsdCents) {
          tier.inProgressToward += 1;
        }
      }
    }

    recentAchievers.sort((a, b) => b.volumeUsdCents - a.volumeUsdCents);

    // Enrich a few with referral codes / names for admin UI.
    const top = recentAchievers.slice(0, 25);
    const enriched = await Promise.all(
      top.map(async (row) => {
        const userSnap = await db.collection(Collections.users).doc(row.userId).get();
        const u = userSnap.data() ?? {};
        return {
          ...row,
          referralCode: String(u.referralCode ?? ''),
          displayName: typeof u.displayName === 'string' ? u.displayName : null,
        };
      }),
    );

    return {
      campaign: serializeCampaign(cfg),
      totals: {
        trackedUsers: snap.size,
        achieved: achievedAny,
        inProgress,
        pending: inProgress + notStarted,
        notStarted,
      },
      tiers: tierStats,
      topAchievers: enriched,
      refreshedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Admin helper: seed default Diwali campaign if missing. */
export const seedAdminCampaignDefaults = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const admin = requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
    ]);
    const existing = await getDb()
      .collection(Collections.config)
      .doc('dashboardCampaign')
      .get();
    if (existing.exists) {
      return { ok: true as const, seeded: false as const, campaign: serializeCampaign(await readCampaignConfig()) };
    }
    const now = new Date();
    const start = Timestamp.fromDate(new Date(now.getFullYear(), 10, 1)); // Nov 1
    const end = Timestamp.fromDate(new Date(now.getFullYear() + 1, 0, 1, 23, 59, 59)); // Jan 1 next year
    const saved = await writeCampaignConfig(
      normalizeCampaign({
        enabled: true,
        title: 'November Mining Special Offer',
        subtitle: 'Diwali to New Year Campaign',
        bannerUrl: '/campaign-banner.jpg',
        startsAt: start,
        endsAt: end,
        maxShows: 0,
        requiredDirectReferrals: 3,
        volumeSource: 'deposits_and_staking',
        tiers: DEFAULT_CAMPAIGN_TIERS,
      }),
      admin.uid,
    );
    await writeAuditLog({
      actorId: admin.uid,
      action: 'campaign.seed',
      resourceType: 'config',
      resourceId: 'dashboardCampaign',
      metadata: { enabled: true },
    });
    return { ok: true as const, seeded: true as const, campaign: serializeCampaign(saved) };
  } catch (err) {
    throw toHttpsError(err);
  }
});
