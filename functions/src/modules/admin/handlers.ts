import { onCall, CallableRequest } from 'firebase-functions/v2/https';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  AdminRole,
  ALL_ADMIN_ROLES,
  requireAdminRole,
} from '../../lib/permissions';
import { listPendingSchema, listUsersSchema } from './schemas';

function tsToIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  const v = value as { toDate?: () => Date };
  if (typeof v.toDate === 'function') return v.toDate().toISOString();
  return null;
}

async function handleListUsers(
  request: CallableRequest,
): Promise<{ users: Array<Record<string, unknown>>; nextCursor: string | null }> {
  requireAdminRole(request, ALL_ADMIN_ROLES);
  const parsed = listUsersSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  let query = db.collection(Collections.users).orderBy('uid').limit(parsed.data.limit);

  if (parsed.data.status) {
    query = db
      .collection(Collections.users)
      .where('status', '==', parsed.data.status)
      .orderBy('uid')
      .limit(parsed.data.limit);
  }

  if (parsed.data.startAfterUid) {
    query = query.startAfter(parsed.data.startAfterUid);
  }

  const snap = await query.get();
  let users = snap.docs
    .map((d) => {
      const data = d.data();
      return {
        uid: (data.uid as string) ?? d.id,
        email: (data.email as string | null) ?? null,
        displayName: (data.displayName as string | null) ?? null,
        mobile: (data.mobile as string | null) ?? null,
        referralCode: (data.referralCode as string | null) ?? null,
        referredBy: (data.referredBy as string | null) ?? null,
        walletAddress: (data.walletAddress as string | null) ?? null,
        status: data.status as string | undefined,
        kycStatus: data.kycStatus as string | undefined,
        adminRole: (data.adminRole as string | null) ?? null,
        createdAt: tsToIso(data.createdAt),
        referredByName: null as string | null,
        referredByCode: null as string | null,
      };
    })
    // Hide unfinished wallet-login stubs (no email/name/mobile) from the admin list.
    .filter((u) => {
      if (!u.uid.startsWith('w_')) return true;
      return Boolean(u.email || u.displayName || u.mobile || u.walletAddress);
    });

  const referrerIds = [
    ...new Set(users.map((u) => u.referredBy).filter((id): id is string => Boolean(id))),
  ];
  if (referrerIds.length > 0) {
    const refs = await Promise.all(
      referrerIds.map((id) => db.collection(Collections.users).doc(id).get()),
    );
    const byId = new Map(
      refs
        .filter((s) => s.exists)
        .map((s) => {
          const data = s.data()!;
          return [
            s.id,
            {
              name: (data.displayName as string | null) ?? (data.email as string | null) ?? null,
              code: (data.referralCode as string | null) ?? null,
            },
          ] as const;
        }),
    );
    users = users.map((u) => {
      if (!u.referredBy) return u;
      const ref = byId.get(u.referredBy);
      return {
        ...u,
        referredByName: ref?.name ?? null,
        referredByCode: ref?.code ?? null,
      };
    });
  }

  const last = users[users.length - 1];
  return {
    users,
    nextCursor: last ? last.uid : null,
  };
}

export const listUsers = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleListUsers(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleListPendingDeposits(
  request: CallableRequest,
): Promise<{ deposits: Array<Record<string, unknown>> }> {
  requireAdminRole(request, [
    AdminRole.SuperAdmin,
    AdminRole.FinanceAdmin,
    AdminRole.ReadonlyAdmin,
  ]);
  const parsed = listPendingSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  const snap = await db
    .collection(Collections.deposits)
    .where('status', '==', 'pending')
    .limit(parsed.data.limit)
    .get();

  const deposits = snap.docs.map((d) => {
    const data = d.data();
    return {
      depositId: data.depositId,
      userId: data.userId,
      currency: data.currency,
      amountMinor: data.amountMinor,
      method: data.method,
      createdAt: data.createdAt ?? null,
    };
  });

  return { deposits };
}

export const listPendingDeposits = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleListPendingDeposits(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleListPendingWithdrawals(
  request: CallableRequest,
): Promise<{ withdrawals: Array<Record<string, unknown>> }> {
  requireAdminRole(request, [
    AdminRole.SuperAdmin,
    AdminRole.FinanceAdmin,
    AdminRole.ReadonlyAdmin,
  ]);
  const parsed = listPendingSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  // pending + approved + processing are "in flight"
  const snap = await db
    .collection(Collections.withdrawals)
    .where('status', 'in', ['pending', 'approved', 'processing'])
    .limit(parsed.data.limit)
    .get();

  const withdrawals = snap.docs.map((d) => {
    const data = d.data();
    return {
      withdrawalId: data.withdrawalId,
      userId: data.userId,
      currency: data.currency,
      amountMinor: data.amountMinor,
      status: data.status,
      method: data.method,
      createdAt: data.createdAt ?? null,
    };
  });

  return { withdrawals };
}

export const listPendingWithdrawals = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleListPendingWithdrawals(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleGetPlatformStats(
  request: CallableRequest,
): Promise<{
  userCount: number;
  pendingDeposits: number;
  pendingWithdrawals: number;
  openTickets: number;
}> {
  requireAdminRole(request, ALL_ADMIN_ROLES);
  const db = getDb();

  // Aggregation via count() — safe, no full document scans returned to client.
  const [usersAgg, depositsAgg, withdrawalsAgg, ticketsAgg] = await Promise.all([
    db.collection(Collections.users).count().get(),
    db
      .collection(Collections.deposits)
      .where('status', '==', 'pending')
      .count()
      .get(),
    db
      .collection(Collections.withdrawals)
      .where('status', 'in', ['pending', 'approved', 'processing'])
      .count()
      .get(),
    db
      .collection(Collections.supportTickets)
      .where('status', 'in', ['open', 'in_progress'])
      .count()
      .get(),
  ]);

  return {
    userCount: usersAgg.data().count,
    pendingDeposits: depositsAgg.data().count,
    pendingWithdrawals: withdrawalsAgg.data().count,
    openTickets: ticketsAgg.data().count,
  };
}

export const getPlatformStats = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleGetPlatformStats(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});
