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

async function handleListUsers(
  request: CallableRequest,
): Promise<{ users: Array<Record<string, unknown>>; nextCursor: string | null }> {
  requireAdminRole(request, ALL_ADMIN_ROLES);
  const parsed = listUsersSchema.safeParse(request.data ?? {});
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const db = getDb();
  let query = db
    .collection(Collections.users)
    .orderBy('uid')
    .limit(parsed.data.limit);

  if (parsed.data.startAfterUid) {
    query = query.startAfter(parsed.data.startAfterUid);
  }

  const snap = await query.get();
  const users = snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: data.uid,
      email: data.email ?? null,
      displayName: data.displayName ?? null,
      status: data.status,
      kycStatus: data.kycStatus,
      adminRole: data.adminRole ?? null,
      createdAt: data.createdAt ?? null,
    };
  });

  const last = users[users.length - 1];
  return {
    users,
    nextCursor: last ? (last.uid as string) : null,
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
