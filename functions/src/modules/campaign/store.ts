import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { Collections, getDb } from '../../lib/firebase';
import {
  CAMPAIGN_CONFIG_DOC,
  CAMPAIGN_PROGRESS,
  CAMPAIGN_VIEWS,
  defaultCampaignConfig,
  type CampaignTier,
  type CampaignUserProgress,
  type DashboardCampaignConfig,
} from './types';
import { countDirectReferrals } from '../staking/commissions';

function toMillis(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  if (typeof (value as { toMillis?: () => number }).toMillis === 'function') {
    return (value as Timestamp).toMillis();
  }
  if (typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as Timestamp).toDate().getTime();
  }
  return null;
}

export function normalizeCampaign(
  raw: Partial<DashboardCampaignConfig> | undefined | null,
): DashboardCampaignConfig {
  const base = defaultCampaignConfig();
  if (!raw) return base;
  const tiers = Array.isArray(raw.tiers) && raw.tiers.length
    ? [...raw.tiers]
        .map((t, i) => ({
          id: String(t.id || `tier_${i + 1}`),
          name: String(t.name || `Tier ${i + 1}`),
          targetUsdCents: Math.max(0, Math.floor(Number(t.targetUsdCents) || 0)),
          nightsLabel: String(t.nightsLabel || ''),
          sortOrder: Number.isFinite(Number(t.sortOrder)) ? Number(t.sortOrder) : i + 1,
        }))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.targetUsdCents - b.targetUsdCents)
    : base.tiers;

  return {
    enabled: raw.enabled !== false,
    title: String(raw.title || base.title).slice(0, 120),
    subtitle: String(raw.subtitle ?? base.subtitle).slice(0, 200),
    bannerUrl: raw.bannerUrl ? String(raw.bannerUrl).slice(0, 2000) : base.bannerUrl,
    storagePath: raw.storagePath ? String(raw.storagePath).slice(0, 500) : null,
    startsAt: (raw.startsAt as DashboardCampaignConfig['startsAt']) ?? null,
    endsAt: (raw.endsAt as DashboardCampaignConfig['endsAt']) ?? null,
    maxShows: Math.max(0, Math.min(10_000, Math.floor(Number(raw.maxShows) || 0))),
    requiredDirectReferrals: Math.max(
      0,
      Math.min(100, Math.floor(Number(raw.requiredDirectReferrals) || 0)),
    ),
    volumeSource:
      raw.volumeSource === 'deposits' ||
      raw.volumeSource === 'staking' ||
      raw.volumeSource === 'deposits_and_staking'
        ? raw.volumeSource
        : base.volumeSource,
    tiers,
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? null,
  };
}

export async function readCampaignConfig(): Promise<DashboardCampaignConfig> {
  const snap = await getDb().collection(Collections.config).doc(CAMPAIGN_CONFIG_DOC).get();
  return normalizeCampaign(snap.exists ? (snap.data() as DashboardCampaignConfig) : null);
}

export async function writeCampaignConfig(
  next: DashboardCampaignConfig,
  actorId: string,
): Promise<DashboardCampaignConfig> {
  const payload: DashboardCampaignConfig = {
    ...normalizeCampaign(next),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorId,
  };
  await getDb().collection(Collections.config).doc(CAMPAIGN_CONFIG_DOC).set(payload, { merge: true });
  return normalizeCampaign({ ...payload, updatedAt: Timestamp.now() });
}

/** Whether the campaign is currently live for members. */
export function isCampaignLive(cfg: DashboardCampaignConfig, nowMs = Date.now()): boolean {
  if (!cfg.enabled) return false;
  const start = toMillis(cfg.startsAt);
  const end = toMillis(cfg.endsAt);
  if (start != null && nowMs < start) return false;
  if (end != null && nowMs > end) return false;
  return true;
}

export function serializeCampaign(cfg: DashboardCampaignConfig) {
  return {
    enabled: cfg.enabled,
    title: cfg.title,
    subtitle: cfg.subtitle,
    bannerUrl: cfg.bannerUrl,
    storagePath: cfg.storagePath,
    startsAt: toMillis(cfg.startsAt) != null ? new Date(toMillis(cfg.startsAt)!).toISOString() : null,
    endsAt: toMillis(cfg.endsAt) != null ? new Date(toMillis(cfg.endsAt)!).toISOString() : null,
    maxShows: cfg.maxShows,
    requiredDirectReferrals: cfg.requiredDirectReferrals,
    volumeSource: cfg.volumeSource,
    tiers: cfg.tiers,
    live: isCampaignLive(cfg),
  };
}

async function sumDepositVolumeUsdCents(
  userId: string,
  startMs: number | null,
  endMs: number | null,
): Promise<number> {
  const db = getDb();
  const snap = await db
    .collection(Collections.deposits)
    .where('userId', '==', userId)
    .where('status', 'in', ['approved', 'completed'])
    .limit(200)
    .get();
  let total = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const created = toMillis(d.createdAt) ?? toMillis(d.reviewedAt) ?? null;
    if (startMs != null && created != null && created < startMs) continue;
    if (endMs != null && created != null && created > endMs) continue;
    const currency = String(d.currency || 'USD');
    const amount = Math.floor(Number(d.amountMinor) || 0);
    if (currency === 'VFXT') {
      // Treat whole VFXT tokens using tokensPerUsd from deposit if present, else skip conversion noise.
      const tpu = Number(d.tokensPerUsd);
      if (Number.isFinite(tpu) && tpu > 0) {
        total += Math.floor((amount * 100) / tpu);
      }
    } else {
      total += amount;
    }
  }
  return total;
}

async function sumStakingVolumeUsdCents(
  userId: string,
  startMs: number | null,
  endMs: number | null,
): Promise<number> {
  const db = getDb();
  const snap = await db
    .collection(Collections.stakingPositions)
    .where('userId', '==', userId)
    .limit(200)
    .get();
  let total = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    const status = String(d.status || '');
    if (status === 'cancelled') continue;
    const created = toMillis(d.createdAt);
    if (startMs != null && created != null && created < startMs) continue;
    if (endMs != null && created != null && created > endMs) continue;
    total += Math.floor(Number(d.principalMinor ?? d.amountMinor) || 0);
  }
  return total;
}

export async function computeUserVolumeUsdCents(
  userId: string,
  cfg: DashboardCampaignConfig,
): Promise<number> {
  const startMs = toMillis(cfg.startsAt);
  const endMs = toMillis(cfg.endsAt);
  let total = 0;
  if (cfg.volumeSource === 'deposits' || cfg.volumeSource === 'deposits_and_staking') {
    total += await sumDepositVolumeUsdCents(userId, startMs, endMs);
  }
  if (cfg.volumeSource === 'staking' || cfg.volumeSource === 'deposits_and_staking') {
    total += await sumStakingVolumeUsdCents(userId, startMs, endMs);
  }
  return total;
}

export function evaluateProgress(
  cfg: DashboardCampaignConfig,
  volumeUsdCents: number,
  directReferrals: number,
  views: number,
): Omit<CampaignUserProgress, 'userId' | 'updatedAt'> {
  const referralsMet = directReferrals >= cfg.requiredDirectReferrals;
  const sorted = [...cfg.tiers].sort((a, b) => a.targetUsdCents - b.targetUsdCents);
  const achieved: CampaignTier[] = [];
  for (const tier of sorted) {
    if (volumeUsdCents >= tier.targetUsdCents && referralsMet) {
      achieved.push(tier);
    }
  }
  const highest = achieved.length ? achieved[achieved.length - 1]! : null;
  const next = sorted.find((t) => volumeUsdCents < t.targetUsdCents) ?? null;
  let status: CampaignUserProgress['status'] = 'not_started';
  if (achieved.length > 0) status = 'achieved';
  else if (volumeUsdCents > 0 || directReferrals > 0) status = 'in_progress';

  return {
    volumeUsdCents,
    directReferrals,
    referralsMet,
    achievedTierIds: achieved.map((t) => t.id),
    highestTierId: highest?.id ?? null,
    nextTierId: next?.id ?? null,
    nextTierRemainingCents: next
      ? Math.max(0, next.targetUsdCents - volumeUsdCents)
      : null,
    status,
    views,
  };
}

export async function getUserViews(userId: string): Promise<number> {
  const snap = await getDb().collection(CAMPAIGN_VIEWS).doc(userId).get();
  if (!snap.exists) return 0;
  return Math.max(0, Math.floor(Number(snap.data()?.views) || 0));
}

export async function incrementUserViews(userId: string): Promise<number> {
  const ref = getDb().collection(CAMPAIGN_VIEWS).doc(userId);
  const next = await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? Math.max(0, Math.floor(Number(snap.data()?.views) || 0)) : 0;
    const views = current + 1;
    tx.set(
      ref,
      {
        userId,
        views,
        lastViewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return views;
  });
  return next;
}

export async function buildUserProgress(
  userId: string,
  cfg: DashboardCampaignConfig,
  opts?: { incrementView?: boolean },
): Promise<CampaignUserProgress> {
  const db = getDb();
  const [volumeUsdCents, directReferrals, viewsBefore] = await Promise.all([
    computeUserVolumeUsdCents(userId, cfg),
    countDirectReferrals(db, userId),
    getUserViews(userId),
  ]);

  let views = viewsBefore;
  if (opts?.incrementView && shouldShowBanner(cfg, viewsBefore)) {
    views = await incrementUserViews(userId);
  }

  const evaluated = evaluateProgress(cfg, volumeUsdCents, directReferrals, views);
  const progress: CampaignUserProgress = {
    userId,
    ...evaluated,
    updatedAt: FieldValue.serverTimestamp(),
  };

  await db.collection(CAMPAIGN_PROGRESS).doc(userId).set(
    {
      ...progress,
      campaignId: CAMPAIGN_CONFIG_DOC,
      highestTierName:
        cfg.tiers.find((t) => t.id === progress.highestTierId)?.name ?? null,
    },
    { merge: true },
  );

  return progress;
}

export function shouldShowBanner(
  cfg: DashboardCampaignConfig,
  views: number,
): boolean {
  if (!isCampaignLive(cfg)) return false;
  if (!cfg.bannerUrl) return false;
  if (cfg.maxShows === 0) return true;
  return views < cfg.maxShows;
}
