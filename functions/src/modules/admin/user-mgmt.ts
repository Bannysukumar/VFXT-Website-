import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getAdminAuth, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import { AdminRole, requireAdminRole } from '../../lib/permissions';
import { assertPositiveMinor } from '../../lib/money';
import { writeAuditLog } from '../audit/handlers';
import { creditAvailable, debitAvailable } from '../wallets/ledger';
import { ensureUserWallets } from '../wallets/handlers';
import { walletDocId } from '../wallets/types';
import { type WalletKind } from '../../config/plan';

const walletKindSchema = z.enum([
  'fund',
  'staking',
  'daily_roi',
  'level_income',
  'direct_referral',
  'withdrawal',
  'vfxt',
]);

export const getAdminUserDetail = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.FinanceAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.SupportAdmin,
    ]);
    const uid = z.string().min(1).max(128).parse((request.data as { uid?: string })?.uid);
    const db = getDb();
    const userSnap = await db.collection(Collections.users).doc(uid).get();
    if (!userSnap.exists) throw new AppError('not-found', 'User not found');

    let authUser: {
      email?: string;
      disabled?: boolean;
      emailVerified?: boolean;
    } = {};
    try {
      const u = await getAdminAuth().getUser(uid);
      authUser = {
        email: u.email,
        disabled: u.disabled,
        emailVerified: u.emailVerified,
      };
    } catch {
      /* profile-only */
    }

    await ensureUserWallets(db, uid);
    const walletsSnap = await db.collection(Collections.wallets).where('userId', '==', uid).get();
    const wallets = walletsSnap.docs.map((d) => {
      const w = d.data();
      return {
        walletId: d.id,
        kind: w.kind as string,
        currency: w.currency as string,
        availableMinor: w.availableMinor as number,
        reservedMinor: w.reservedMinor as number,
      };
    });

    return {
      profile: { uid, ...userSnap.data() },
      auth: authUser,
      wallets,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

const mobileSchema = z
  .string()
  .max(24)
  .optional()
  .or(z.literal(''))
  .refine((v) => !v || v.trim() === '' || /^[+0-9][0-9\s\-()]{7,22}$/.test(v.trim()), {
    message: 'Enter a valid mobile number (with country code) or leave blank',
  });

const walletAddressSchema = z
  .union([
    z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'Enter a valid BEP-20 wallet (0x + 40 hex) or leave blank'),
    z.literal(''),
    z.null(),
  ])
  .optional();

const updateUserSchema = z
  .object({
    uid: z.string().min(1).max(128),
    displayName: z.string().min(1).max(80).optional(),
    mobile: mobileSchema,
    status: z.enum(['active', 'suspended', 'closed']).optional(),
    kycStatus: z.enum(['none', 'pending', 'verified', 'rejected']).optional(),
    disabled: z.boolean().optional(),
    withdrawalAddress: z.string().max(128).nullable().optional().or(z.literal('')),
    walletAddress: walletAddressSchema,
  })
  .strict();

export const adminUpdateUser = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.SupportAdmin,
    ]);
    const parsed = updateUserSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const field = issue?.path?.length ? `${issue.path.join('.')}: ` : '';
      throw new AppError(
        'invalid-argument',
        `${field}${issue?.message ?? 'Invalid payload'}`.trim(),
      );
    }
    const { uid, disabled, ...profilePatch } = parsed.data;
    const db = getDb();
    const ref = db.collection(Collections.users).doc(uid);
    const snap = await ref.get();
    if (!snap.exists) throw new AppError('not-found', 'User not found');

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (profilePatch.displayName !== undefined) updates.displayName = profilePatch.displayName;
    if (profilePatch.mobile !== undefined) {
      const mobile = profilePatch.mobile.replace(/\s+/g, ' ').trim();
      updates.mobile = mobile || null;
    }
    if (profilePatch.status !== undefined) updates.status = profilePatch.status;
    if (profilePatch.kycStatus !== undefined) updates.kycStatus = profilePatch.kycStatus;
    if (profilePatch.withdrawalAddress !== undefined) {
      updates.withdrawalAddress = profilePatch.withdrawalAddress || null;
    }
    if (profilePatch.walletAddress !== undefined) {
      const wallet = (profilePatch.walletAddress || '').trim();
      updates.walletAddress = wallet ? wallet.toLowerCase() : null;
    }

    await ref.update(updates);

    if (disabled !== undefined) {
      if (ctx.adminRole !== AdminRole.SuperAdmin && ctx.adminRole !== AdminRole.OperationsAdmin) {
        throw new AppError('permission-denied', 'Only ops/super admin can disable accounts');
      }
      await getAdminAuth().updateUser(uid, { disabled });
    }

    await writeAuditLog({
      actorId: ctx.uid,
      action: 'admin.user.update',
      resourceType: 'user',
      resourceId: uid,
      metadata: { keys: Object.keys(parsed.data).filter((k) => k !== 'uid') },
    });

    return { ok: true as const };
  } catch (err) {
    throw toHttpsError(err);
  }
});

const adjustWalletSchema = z
  .object({
    uid: z.string().min(1).max(128),
    walletKind: walletKindSchema,
    /** Positive credits, negative debits (absolute amountMinor must be > 0). */
    amountMinor: z.number().int(),
    reason: z.string().min(3).max(300),
  })
  .strict();

export const adminAdjustWallet = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin, AdminRole.FinanceAdmin]);
    const parsed = adjustWalletSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid payload');
    }
    const { uid, walletKind, amountMinor, reason } = parsed.data;
    if (amountMinor === 0) throw new AppError('invalid-argument', 'amountMinor cannot be 0');
    const abs = Math.abs(amountMinor);
    assertPositiveMinor(abs);

    const db = getDb();
    await ensureUserWallets(db, uid);
    const walletId = walletDocId(uid, walletKind as WalletKind);
    const currency = walletKind === 'vfxt' || walletKind === 'direct_referral' ? 'VFXT' : 'USD';

    await db.runTransaction(async (tx) => {
      if (amountMinor > 0) {
        await creditAvailable(tx, db, {
          userId: uid,
          walletId,
          type: 'adjustment',
          amountMinor: abs,
          currency,
          referenceType: 'admin',
          referenceId: `adj_${Date.now()}`,
          description: reason,
          createdBy: ctx.uid,
          metadata: { reason, direction: 'credit' },
        });
      } else {
        await debitAvailable(tx, db, {
          userId: uid,
          walletId,
          type: 'adjustment',
          amountMinor: abs,
          currency,
          referenceType: 'admin',
          referenceId: `adj_${Date.now()}`,
          description: reason,
          createdBy: ctx.uid,
          metadata: { reason, direction: 'debit' },
        });
      }
    });

    await writeAuditLog({
      actorId: ctx.uid,
      action: 'admin.wallet.adjust',
      resourceType: 'wallet',
      resourceId: walletId,
      metadata: { uid, walletKind, amountMinor, reason },
    });

    return { ok: true as const, walletId };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Super admin: mint a custom token to view the app as that user. */
export const impersonateUser = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin]);
    const uid = z.string().min(1).max(128).parse((request.data as { uid?: string })?.uid);
    if (uid === ctx.uid) {
      throw new AppError('invalid-argument', 'Cannot impersonate yourself');
    }
    const user = await getAdminAuth().getUser(uid);
    if (user.disabled) {
      throw new AppError('failed-precondition', 'User account is disabled');
    }
    const token = await getAdminAuth().createCustomToken(uid, {
      impersonatedBy: ctx.uid,
    });
    await writeAuditLog({
      actorId: ctx.uid,
      action: 'admin.user.impersonate',
      resourceType: 'user',
      resourceId: uid,
      metadata: {},
    });
    return { token, uid, email: user.email ?? null };
  } catch (err) {
    throw toHttpsError(err);
  }
});

