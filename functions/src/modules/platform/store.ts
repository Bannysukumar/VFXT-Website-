import { FieldValue } from 'firebase-admin/firestore';
import { Collections, getDb } from '../../lib/firebase';
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
  type PlanSettings,
  type ContactSettings,
  type FooterSettings,
  type WithdrawSettings,
  type DepositSettings,
  type TokenEconomicsSettings,
  type HotWalletPoolSettings,
} from './types';

const PLATFORM_DOC = 'platform';

function deepMergePlatform(
  base: PlatformSettings,
  patch: Partial<PlatformSettings>,
): PlatformSettings {
  return {
    ...base,
    ...patch,
    contact: { ...base.contact, ...(patch.contact ?? {}) },
    footer: {
      ...base.footer,
      ...(patch.footer ?? {}),
      columns: patch.footer?.columns ?? base.footer.columns,
      socials: patch.footer?.socials ?? base.footer.socials ?? [],
    },
    plan: {
      ...base.plan,
      ...(patch.plan ?? {}),
      levelCommissionBps:
        patch.plan?.levelCommissionBps ?? base.plan.levelCommissionBps,
      lockedPackages: patch.plan?.lockedPackages ?? base.plan.lockedPackages,
      rankRewards: patch.plan?.rankRewards ?? base.plan.rankRewards,
    },
    deposit: { ...base.deposit, ...(patch.deposit ?? {}) },
    token: { ...base.token, ...(patch.token ?? {}) },
    withdraw: { ...base.withdraw, ...(patch.withdraw ?? {}) },
    hotWalletPool: { ...base.hotWalletPool, ...(patch.hotWalletPool ?? {}) },
  };
}

export async function getPlatformSettings(): Promise<PlatformSettings> {
  const snap = await getDb().collection(Collections.config).doc(PLATFORM_DOC).get();
  if (!snap.exists) return structuredClone(DEFAULT_PLATFORM_SETTINGS);
  const merged = deepMergePlatform(
    DEFAULT_PLATFORM_SETTINGS,
    snap.data() as Partial<PlatformSettings>,
  );
  // Backfill maxCycles on older rank rows saved before the field existed.
  merged.plan.rankRewards = (merged.plan.rankRewards ?? []).map((r) => ({
    ...r,
    maxCycles:
      Number.isFinite(Number(r.maxCycles)) && Number(r.maxCycles) > 0
        ? Math.floor(Number(r.maxCycles))
        : 12,
  }));
  return merged;
}

export async function savePlatformSettings(
  patch: Partial<PlatformSettings>,
  actorId: string,
): Promise<PlatformSettings> {
  const current = await getPlatformSettings();
  const next = deepMergePlatform(current, patch);
  next.updatedAt = FieldValue.serverTimestamp();
  next.updatedBy = actorId;
  await getDb().collection(Collections.config).doc(PLATFORM_DOC).set(next, { merge: true });
  return getPlatformSettings();
}

export async function getPlanSettings(): Promise<PlanSettings> {
  return (await getPlatformSettings()).plan;
}

export async function getContactSettings(): Promise<ContactSettings> {
  return (await getPlatformSettings()).contact;
}

export async function getFooterSettings(): Promise<FooterSettings> {
  return (await getPlatformSettings()).footer;
}

export async function getWithdrawSettings(): Promise<WithdrawSettings> {
  return (await getPlatformSettings()).withdraw;
}

export async function getDepositSettings(): Promise<DepositSettings> {
  return (await getPlatformSettings()).deposit;
}

export async function getTokenEconomicsSettings(): Promise<TokenEconomicsSettings> {
  return (await getPlatformSettings()).token;
}

export async function getHotWalletPoolSettings(): Promise<HotWalletPoolSettings> {
  return (await getPlatformSettings()).hotWalletPool;
}
