import { onCall } from 'firebase-functions/v2/https';
import type { Firestore } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { AdminRole, requireAdminRole } from '../../lib/permissions';

const FINANCE_READ = [
  AdminRole.SuperAdmin,
  AdminRole.FinanceAdmin,
  AdminRole.ReadonlyAdmin,
  AdminRole.OperationsAdmin,
] as const;

const listSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(500),
});

const incomeSchema = listSchema.extend({
  type: z.enum([
    'roi',
    'level_commission',
    'direct_bonus',
    'referral_bonus',
    'rank_reward',
    'staking_reward',
    'locked_maturity',
    'locked_bonus',
    'deposit_credit',
    'peer_transfer',
  ]),
});

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return null;
}

type UserLabel = { userEmail: string | null; userDisplayName: string | null };

async function loadUserLabels(
  db: Firestore,
  userIds: string[],
): Promise<Map<string, UserLabel>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const out = new Map<string, UserLabel>();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const refs = chunk.map((id) => db.collection(Collections.users).doc(id));
    const snaps = await db.getAll(...refs);
    for (const snap of snaps) {
      if (!snap.exists) {
        out.set(snap.id, { userEmail: null, userDisplayName: null });
        continue;
      }
      const data = snap.data() ?? {};
      out.set(snap.id, {
        userEmail: typeof data.email === 'string' ? data.email : null,
        userDisplayName:
          typeof data.displayName === 'string' ? data.displayName : null,
      });
    }
  }
  return out;
}

function withUserLabel(
  row: Record<string, unknown>,
  labels: Map<string, UserLabel>,
): Record<string, unknown> {
  const uid = String(row.userId ?? '');
  const label = labels.get(uid);
  return {
    ...row,
    userEmail: label?.userEmail ?? null,
    userDisplayName: label?.userDisplayName ?? null,
  };
}

/** Automatic on-chain USDT deposits (crypto monitor credited). */
export const adminListAutoDeposits = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [...FINANCE_READ]);
    const parsed = listSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.message);
    }
    const db = getDb();
    const snap = await db
      .collection(Collections.deposits)
      .where('method', '==', 'usdt_bep20')
      .where('status', 'in', ['completed', 'approved'])
      .limit(parsed.data.limit)
      .get();

    const baseRows = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          depositId: data.depositId ?? d.id,
          userId: data.userId,
          amountMinor: Number(data.amountMinor ?? 0),
          amountUsdt: data.amountMinor != null ? (Number(data.amountMinor) / 100).toFixed(2) : null,
          status: data.status,
          method: data.method,
          txHash: data.txHash ?? null,
          depositAddress: data.depositAddress ?? null,
          vfxtTokensCredited: data.vfxtTokensCredited ?? null,
          tokensPerUsd: data.tokensPerUsd ?? null,
          reviewedBy: data.reviewedBy ?? null,
          createdAt: tsToIso(data.createdAt),
          updatedAt: tsToIso(data.updatedAt),
          reviewedAt: tsToIso(data.reviewedAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    const labels = await loadUserLabels(
      db,
      baseRows.map((r) => String(r.userId ?? '')),
    );
    const rows = baseRows.map((r) => withUserLabel(r, labels));

    return { rows, count: rows.length };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Automatic / crypto USDT withdrawals sent on-chain. */
export const adminListAutoWithdrawals = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [...FINANCE_READ]);
    const parsed = listSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.message);
    }
    const db = getDb();
    const snap = await db
      .collection(Collections.withdrawals)
      .where('method', '==', 'usdt_bep20')
      .where('status', '==', 'completed')
      .limit(parsed.data.limit)
      .get();

    const baseRows = snap.docs
      .map((d) => {
        const data = d.data();
        const amountMinor = Number(data.amountMinor ?? 0);
        const commissionMinor = Number(data.commissionMinor ?? 0);
        const netAmountMinor = Number(
          data.netAmountMinor ?? amountMinor - commissionMinor,
        );
        return {
          id: d.id,
          withdrawalId: data.withdrawalId ?? d.id,
          userId: data.userId,
          amountMinor,
          commissionMinor,
          netAmountMinor,
          commissionBps: data.commissionBps ?? null,
          destination: data.destination ?? null,
          status: data.status,
          method: data.method,
          txHash: data.txHash ?? null,
          reviewedBy: data.reviewedBy ?? null,
          createdAt: tsToIso(data.createdAt),
          completedAt: tsToIso(data.completedAt),
          updatedAt: tsToIso(data.updatedAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    const labels = await loadUserLabels(
      db,
      baseRows.map((r) => String(r.userId ?? '')),
    );
    const rows = baseRows.map((r) => withUserLabel(r, labels));

    return { rows, count: rows.length };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Ledger income rows for one income type. */
export const adminListIncomeByType = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [...FINANCE_READ]);
    const parsed = incomeSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.message);
    }
    const db = getDb();
    const snap = await db
      .collection(Collections.ledger)
      .where('type', '==', parsed.data.type)
      .where('direction', '==', 'credit')
      .limit(parsed.data.limit)
      .get();

    const baseRows = snap.docs
      .map((d) => {
        const data = d.data();
        return {
          id: d.id,
          entryId: data.entryId ?? d.id,
          userId: data.userId,
          walletId: data.walletId,
          type: data.type,
          direction: data.direction,
          amountMinor: Number(data.amountMinor ?? 0),
          currency: data.currency ?? 'VFXT',
          description: data.description ?? '',
          referenceType: data.referenceType ?? null,
          referenceId: data.referenceId ?? null,
          metadata: data.metadata ?? {},
          createdBy: data.createdBy ?? null,
          createdAt: tsToIso(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    const labels = await loadUserLabels(
      db,
      baseRows.map((r) => String(r.userId ?? '')),
    );
    const rows = baseRows.map((r) => withUserLabel(r, labels));

    const totalMinor = rows.reduce((s, r) => s + Number(r.amountMinor ?? 0), 0);
    return { rows, count: rows.length, totalMinor, type: parsed.data.type };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/**
 * Member-to-member transfers (one row per send = debit leg).
 * Includes sender/recipient public user ids from ledger metadata.
 */
export const adminListPeerTransfers = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [...FINANCE_READ]);
    const parsed = listSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.message);
    }
    const db = getDb();
    const snap = await db
      .collection(Collections.ledger)
      .where('type', '==', 'peer_transfer')
      .where('direction', '==', 'debit')
      .limit(parsed.data.limit)
      .get();

    const baseRows = snap.docs
      .map((d) => {
        const data = d.data();
        const meta = (data.metadata ?? {}) as Record<string, unknown>;
        return {
          id: d.id,
          entryId: data.entryId ?? d.id,
          userId: data.userId,
          fromUserId: meta.fromUserId ?? null,
          toUserId: meta.toUserId ?? meta.counterpartyUserId ?? null,
          toUid: meta.counterpartyUid ?? null,
          walletKind: meta.walletKind ?? null,
          amountMinor: Number(data.amountMinor ?? 0),
          currency: data.currency ?? 'VFXT',
          description: data.description ?? '',
          note: meta.note ?? null,
          referenceId: data.referenceId ?? null,
          createdAt: tsToIso(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    const labelIds = [
      ...baseRows.map((r) => String(r.userId ?? '')),
      ...baseRows.map((r) => String(r.toUid ?? '')),
    ];
    const labels = await loadUserLabels(db, labelIds);
    const rows = baseRows.map((r) => {
      const withSender = withUserLabel(r, labels);
      const toLabel = labels.get(String(r.toUid ?? ''));
      return {
        ...withSender,
        toUserEmail: toLabel?.userEmail ?? null,
        toUserDisplayName: toLabel?.userDisplayName ?? null,
      };
    });

    return { rows, count: rows.length };
  } catch (err) {
    throw toHttpsError(err);
  }
});
