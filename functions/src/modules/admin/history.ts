import { onCall } from 'firebase-functions/v2/https';
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
  ]),
});

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return null;
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

    const rows = snap.docs
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

    const rows = snap.docs
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

    const rows = snap.docs
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
          currency: data.currency ?? 'USD',
          description: data.description ?? '',
          referenceType: data.referenceType ?? null,
          referenceId: data.referenceId ?? null,
          metadata: data.metadata ?? {},
          createdBy: data.createdBy ?? null,
          createdAt: tsToIso(data.createdAt),
        };
      })
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

    const totalMinor = rows.reduce((s, r) => s + r.amountMinor, 0);
    return { rows, count: rows.length, totalMinor, type: parsed.data.type };
  } catch (err) {
    throw toHttpsError(err);
  }
});
