import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { AppError } from '../../lib/errors';
import { getDb } from '../../lib/firebase';
import {
  adminListClaims,
  adminMiningDashboard,
  adminSetClaimStatus,
  claimRewards,
  getMiningConfig,
  getMiningHistory,
  getMiningStatus,
  listClaims,
  startMiningSession,
  stopMiningSession,
  updateMiningConfig,
} from './service';
import { parseToMinor, toMinorString } from './money';

function requireUid(request: { auth?: { uid: string } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new AppError('unauthenticated', 'Sign in required');
  return uid;
}

async function requireActiveWalletUser(uid: string): Promise<{ walletAddress: string }> {
  const snap = await getDb().collection('users').doc(uid).get();
  if (!snap.exists) throw new AppError('failed-precondition', 'User profile missing');
  const data = snap.data()!;
  if (data.accountStatus === 'suspended') {
    throw new AppError('permission-denied', 'Account suspended');
  }
  const walletAddress = String(data.walletAddress ?? '');
  if (!/^0x[a-f0-9]{40}$/.test(walletAddress)) {
    throw new AppError('failed-precondition', 'Wallet address not linked');
  }
  return { walletAddress };
}

function isAdmin(auth: { token?: Record<string, unknown> } | undefined): boolean {
  const role = auth?.token?.adminRole;
  return typeof role === 'string' && role.length > 0;
}

export const getMiningConfigPublic = onCall(CALLABLE_OPTS, async () => {
  try {
    const config = await getMiningConfig();
    return {
      enabled: config.enabled,
      ratePerHour: config.ratePerHourMinor,
      durationSeconds: config.durationSeconds,
      minimumClaim: config.minimumClaimMinor,
      allowStop: config.allowStop,
      payoutMode: config.payoutMode,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const miningStatus = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    await requireActiveWalletUser(uid);
    return await getMiningStatus(uid);
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const miningStart = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    const { walletAddress } = await requireActiveWalletUser(uid);
    const session = await startMiningSession(uid, walletAddress);
    return {
      sessionId: session.sessionId,
      startTimeMillis: session.startTime.toMillis(),
      endTimeMillis: session.endTime.toMillis(),
      rateSnapshotPerHour: session.rateSnapshotMinor,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const miningStop = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    await requireActiveWalletUser(uid);
    return await stopMiningSession(uid);
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const miningHistory = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    await requireActiveWalletUser(uid);
    const limit = z.object({ limit: z.number().int().min(1).max(100).optional() })
      .safeParse(request.data ?? {}).data?.limit;
    return { items: await getMiningHistory(uid, limit) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const rewardsClaim = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    const { walletAddress } = await requireActiveWalletUser(uid);
    const parsed = z
      .object({
        destinationAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
        idempotencyKey: z.string().min(8).max(128).optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid claim request');
    const destination = (parsed.data.destinationAddress ?? walletAddress).toLowerCase();
    return await claimRewards(uid, destination, parsed.data.idempotencyKey);
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const rewardsClaims = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const uid = requireUid(request);
    await requireActiveWalletUser(uid);
    return { items: await listClaims(uid) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminGetMiningConfig = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    return await getMiningConfig();
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminUpdateMiningConfig = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    const parsed = z
      .object({
        enabled: z.boolean().optional(),
        ratePerHour: z.string().optional(),
        durationSeconds: z.number().int().min(60).max(86400 * 7).optional(),
        minimumClaim: z.string().optional(),
        maximumReward: z.string().optional(),
        allowStop: z.boolean().optional(),
        payoutMode: z.enum(['admin_approved', 'automatic']).optional(),
        boosterPaymentWallet: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .nullable()
          .optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid mining config');

    const patch: Record<string, unknown> = {};
    if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;
    if (parsed.data.durationSeconds !== undefined) patch.durationSeconds = parsed.data.durationSeconds;
    if (parsed.data.allowStop !== undefined) patch.allowStop = parsed.data.allowStop;
    if (parsed.data.payoutMode !== undefined) patch.payoutMode = parsed.data.payoutMode;
    if (parsed.data.ratePerHour !== undefined) {
      patch.ratePerHourMinor = toMinorString(parseToMinor(parsed.data.ratePerHour));
    }
    if (parsed.data.minimumClaim !== undefined) {
      patch.minimumClaimMinor = toMinorString(parseToMinor(parsed.data.minimumClaim));
    }
    if (parsed.data.maximumReward !== undefined) {
      patch.maximumRewardMinor = toMinorString(parseToMinor(parsed.data.maximumReward));
    }
    if (parsed.data.boosterPaymentWallet !== undefined) {
      patch.boosterPaymentWallet = parsed.data.boosterPaymentWallet
        ? parsed.data.boosterPaymentWallet.toLowerCase()
        : null;
    }
    return await updateMiningConfig(patch);
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminUpdateClaim = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    const parsed = z
      .object({
        claimId: z.string().min(8),
        status: z.enum(['approved', 'rejected', 'paid', 'failed']),
        reason: z.string().max(500).optional(),
        transactionHash: z.string().max(100).optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid claim update');
    return await adminSetClaimStatus(parsed.data.claimId, parsed.data.status, {
      reason: parsed.data.reason,
      transactionHash: parsed.data.transactionHash,
    });
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminListMiningClaims = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    const parsed = z
      .object({
        status: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      })
      .safeParse(request.data ?? {});
    if (!parsed.success) throw new AppError('invalid-argument', 'Invalid request');
    return { items: await adminListClaims(parsed.data.status, parsed.data.limit) };
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const adminMiningDashboardStats = onCall(CALLABLE_OPTS, async (request) => {
  try {
    if (!isAdmin(request.auth)) throw new AppError('permission-denied', 'Admin only');
    return await adminMiningDashboard();
  } catch (err) {
    throw toHttpsError(err);
  }
});
