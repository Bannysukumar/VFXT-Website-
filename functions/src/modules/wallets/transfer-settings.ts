import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import {
  ALLOWED_TRANSFERS,
  WALLET_KINDS,
  type WalletKind,
} from '../../config/plan';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { AppError } from '../../lib/errors';
import { Collections, getDb } from '../../lib/firebase';
import { AdminRole, requireAdminRole, requireAuth } from '../../lib/permissions';
import { writeAuditLog } from '../audit/handlers';

export const TRANSFER_SETTINGS_DOC = 'transferSettings';

/** Default peer wallets (matches current live behavior). */
export const DEFAULT_PEER_WALLETS: readonly WalletKind[] = [
  'fund',
  'vfxt',
  'withdrawal',
  'direct_referral',
] as const;

export interface TransferRouteSetting {
  from: WalletKind;
  to: WalletKind;
  enabled: boolean;
}

export interface PeerWalletSetting {
  kind: WalletKind;
  enabled: boolean;
}

export interface TransferSettings {
  /** Master switch — when false, all transfers fail. */
  enabled: boolean;
  internalEnabled: boolean;
  peerEnabled: boolean;
  internalRoutes: TransferRouteSetting[];
  peerWallets: PeerWalletSetting[];
  updatedAt?: Timestamp | FieldValue | null;
  updatedBy?: string | null;
}

const walletKindSchema = z.enum([
  'fund',
  'staking',
  'daily_roi',
  'level_income',
  'direct_referral',
  'withdrawal',
  'vfxt',
]);

export function defaultTransferSettings(): TransferSettings {
  return {
    enabled: true,
    internalEnabled: true,
    peerEnabled: true,
    internalRoutes: ALLOWED_TRANSFERS.map((r) => ({
      from: r.from,
      to: r.to,
      enabled: true,
    })),
    peerWallets: DEFAULT_PEER_WALLETS.map((kind) => ({
      kind,
      enabled: true,
    })),
    updatedAt: null,
    updatedBy: null,
  };
}

export function normalizeTransferSettings(
  raw: Partial<TransferSettings> | null | undefined,
): TransferSettings {
  const base = defaultTransferSettings();
  if (!raw) return base;

  const routesIn = Array.isArray(raw.internalRoutes) ? raw.internalRoutes : [];
  const peersIn = Array.isArray(raw.peerWallets) ? raw.peerWallets : [];

  const internalRoutes: TransferRouteSetting[] = [];
  const seenRoutes = new Set<string>();
  for (const r of routesIn) {
    const from = String(r?.from || '') as WalletKind;
    const to = String(r?.to || '') as WalletKind;
    if (!WALLET_KINDS.includes(from) || !WALLET_KINDS.includes(to)) continue;
    if (from === to) continue;
    const key = `${from}:${to}`;
    if (seenRoutes.has(key)) continue;
    seenRoutes.add(key);
    internalRoutes.push({
      from,
      to,
      enabled: r?.enabled !== false,
    });
  }
  // Keep any default routes that were omitted (still present, enabled as default).
  for (const d of base.internalRoutes) {
    const key = `${d.from}:${d.to}`;
    if (!seenRoutes.has(key)) {
      internalRoutes.push(d);
      seenRoutes.add(key);
    }
  }

  const peerWallets: PeerWalletSetting[] = [];
  const seenPeers = new Set<string>();
  for (const p of peersIn) {
    const kind = String(p?.kind || '') as WalletKind;
    if (!WALLET_KINDS.includes(kind)) continue;
    if (seenPeers.has(kind)) continue;
    seenPeers.add(kind);
    peerWallets.push({ kind, enabled: p?.enabled !== false });
  }
  for (const d of base.peerWallets) {
    if (!seenPeers.has(d.kind)) {
      peerWallets.push(d);
      seenPeers.add(d.kind);
    }
  }

  return {
    enabled: raw.enabled !== false,
    internalEnabled: raw.internalEnabled !== false,
    peerEnabled: raw.peerEnabled !== false,
    internalRoutes,
    peerWallets,
    updatedAt: raw.updatedAt ?? null,
    updatedBy: raw.updatedBy ?? null,
  };
}

export async function readTransferSettings(): Promise<TransferSettings> {
  const snap = await getDb()
    .collection(Collections.config)
    .doc(TRANSFER_SETTINGS_DOC)
    .get();
  return normalizeTransferSettings(
    snap.exists ? (snap.data() as TransferSettings) : null,
  );
}

export async function writeTransferSettings(
  next: TransferSettings,
  actorId: string,
): Promise<TransferSettings> {
  const payload: TransferSettings = {
    ...normalizeTransferSettings(next),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: actorId,
  };
  await getDb()
    .collection(Collections.config)
    .doc(TRANSFER_SETTINGS_DOC)
    .set(payload, { merge: true });
  return normalizeTransferSettings({
    ...payload,
    updatedAt: Timestamp.now(),
  });
}

export function serializeTransferSettings(cfg: TransferSettings) {
  return {
    enabled: cfg.enabled,
    internalEnabled: cfg.internalEnabled,
    peerEnabled: cfg.peerEnabled,
    internalRoutes: cfg.internalRoutes,
    peerWallets: cfg.peerWallets,
    walletKinds: [...WALLET_KINDS],
    updatedAt:
      cfg.updatedAt && typeof (cfg.updatedAt as Timestamp).toDate === 'function'
        ? (cfg.updatedAt as Timestamp).toDate().toISOString()
        : null,
  };
}

export async function assertInternalTransferAllowed(
  from: WalletKind,
  to: WalletKind,
): Promise<void> {
  const cfg = await readTransferSettings();
  if (!cfg.enabled) {
    throw new AppError('failed-precondition', 'Transfers are temporarily disabled');
  }
  if (!cfg.internalEnabled) {
    throw new AppError('failed-precondition', 'Internal wallet transfers are disabled');
  }
  const route = cfg.internalRoutes.find((r) => r.from === from && r.to === to);
  if (!route || !route.enabled) {
    throw new AppError(
      'failed-precondition',
      `Transfer ${from} → ${to} is not allowed`,
    );
  }
}

export async function assertPeerTransferAllowed(kind: WalletKind): Promise<void> {
  const cfg = await readTransferSettings();
  if (!cfg.enabled) {
    throw new AppError('failed-precondition', 'Transfers are temporarily disabled');
  }
  if (!cfg.peerEnabled) {
    throw new AppError('failed-precondition', 'Transfers to other users are disabled');
  }
  const peer = cfg.peerWallets.find((p) => p.kind === kind);
  if (!peer || !peer.enabled) {
    throw new AppError(
      'failed-precondition',
      `Peer transfers from ${kind} wallet are not allowed`,
    );
  }
}

/** Member: allowed transfer matrix for the Transfer page. */
export const getMyTransferSettings = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAuth(request);
    const cfg = await readTransferSettings();
    return {
      enabled: cfg.enabled,
      internalEnabled: cfg.internalEnabled && cfg.enabled,
      peerEnabled: cfg.peerEnabled && cfg.enabled,
      internalRoutes: cfg.internalRoutes.filter((r) => r.enabled),
      peerWallets: cfg.peerWallets.filter((p) => p.enabled).map((p) => p.kind),
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const getAdminTransferSettings = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.FinanceAdmin,
      AdminRole.ReadonlyAdmin,
    ]);
    const cfg = await readTransferSettings();
    return { settings: serializeTransferSettings(cfg) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

const updateSchema = z
  .object({
    enabled: z.boolean().optional(),
    internalEnabled: z.boolean().optional(),
    peerEnabled: z.boolean().optional(),
    internalRoutes: z
      .array(
        z.object({
          from: walletKindSchema,
          to: walletKindSchema,
          enabled: z.boolean(),
        }),
      )
      .max(64)
      .optional(),
    peerWallets: z
      .array(
        z.object({
          kind: walletKindSchema,
          enabled: z.boolean(),
        }),
      )
      .max(16)
      .optional(),
  })
  .strict();

export const updateAdminTransferSettings = onCall(CALLABLE_OPTS, async (request) => {
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
        parsed.error.issues[0]?.message ?? 'Invalid transfer settings',
      );
    }
    const current = await readTransferSettings();
    const next = normalizeTransferSettings({
      ...current,
      ...parsed.data,
      internalRoutes: parsed.data.internalRoutes ?? current.internalRoutes,
      peerWallets: parsed.data.peerWallets ?? current.peerWallets,
    });
    const saved = await writeTransferSettings(next, admin.uid);
    await writeAuditLog({
      actorId: admin.uid,
      action: 'transfer_settings.update',
      resourceType: 'config',
      resourceId: TRANSFER_SETTINGS_DOC,
      metadata: {
        enabled: saved.enabled,
        internalEnabled: saved.internalEnabled,
        peerEnabled: saved.peerEnabled,
        internalRouteCount: saved.internalRoutes.length,
        peerWalletCount: saved.peerWallets.length,
      },
    });
    return { ok: true as const, settings: serializeTransferSettings(saved) };
  } catch (err) {
    throw toHttpsError(err);
  }
});
