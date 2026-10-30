import { onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { FieldValue } from 'firebase-admin/firestore';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { Collections, getAdminAuth, getDb } from '../../lib/firebase';
import { AppError } from '../../lib/errors';
import {
  AdminRole,
  requireAuth,
  requireAdminRole,
} from '../../lib/permissions';
import { log } from '../../lib/logger';
import { writeAuditLog } from '../audit/handlers';
import {
  bootstrapFirstAdminSchema,
  setAdminRoleSchema,
} from './schemas';

/** Set via `firebase functions:config` / params — rotate after first admin. */
export const BOOTSTRAP_SECRET = defineString('BOOTSTRAP_SECRET', {
  default: 'vfxt-bootstrap-change-me',
  description: 'One-time secret to create the first Super Admin',
});

async function setClaimsAndAdminDoc(
  targetUid: string,
  adminRole: AdminRole | null,
  actorId: string,
): Promise<void> {
  const auth = getAdminAuth();
  const db = getDb();
  const user = await auth.getUser(targetUid);
  const existingClaims = (user.customClaims ?? {}) as Record<string, unknown>;

  if (adminRole) {
    await auth.setCustomUserClaims(targetUid, {
      ...existingClaims,
      adminRole,
    });
    await db.collection(Collections.admins).doc(targetUid).set(
      {
        uid: targetUid,
        adminRole,
        createdBy: actorId,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await db.collection(Collections.users).doc(targetUid).set(
      {
        adminRole,
        role: 'admin',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } else {
    const { adminRole: _removed, ...rest } = existingClaims;
    await auth.setCustomUserClaims(targetUid, rest);
    await db.collection(Collections.admins).doc(targetUid).delete();
    await db.collection(Collections.users).doc(targetUid).set(
      {
        adminRole: null,
        role: 'user',
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

async function handleSetAdminRole(
  request: CallableRequest,
): Promise<{ ok: true }> {
  const ctx = requireAdminRole(request, [AdminRole.SuperAdmin]);
  const parsed = setAdminRoleSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const { uid, adminRole } = parsed.data;
  if (uid === ctx.uid && adminRole === null) {
    throw new AppError(
      'failed-precondition',
      'Cannot remove your own super_admin role',
    );
  }

  await setClaimsAndAdminDoc(uid, adminRole, ctx.uid);
  await writeAuditLog({
    actorId: ctx.uid,
    action: adminRole ? 'admin.role.set' : 'admin.role.cleared',
    resourceType: 'user',
    resourceId: uid,
    metadata: { adminRole },
  });

  log.info('admin_role_updated', {
    actorId: ctx.uid,
    targetUid: uid,
    adminRole,
  });
  return { ok: true };
}

export const setAdminRole = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleSetAdminRole(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});

async function handleBootstrapFirstAdmin(
  request: CallableRequest,
): Promise<{ ok: true; adminRole: AdminRole }> {
  const ctx = requireAuth(request);
  const parsed = bootstrapFirstAdminSchema.safeParse(request.data);
  if (!parsed.success) {
    throw new AppError('invalid-argument', parsed.error.message);
  }

  const expected = BOOTSTRAP_SECRET.value();
  const provided =
    (parsed.data as { secret?: string; bootstrapSecret?: string }).secret ??
    (parsed.data as { bootstrapSecret?: string }).bootstrapSecret;
  if (!expected || !provided || provided !== expected) {
    throw new AppError('permission-denied', 'Invalid bootstrap secret');
  }

  const db = getDb();
  const existing = await db.collection(Collections.admins).limit(1).get();
  if (!existing.empty) {
    throw new AppError(
      'failed-precondition',
      'Admins already exist; bootstrap disabled',
    );
  }

  await setClaimsAndAdminDoc(ctx.uid, AdminRole.SuperAdmin, ctx.uid);
  await writeAuditLog({
    actorId: ctx.uid,
    action: 'admin.bootstrap',
    resourceType: 'user',
    resourceId: ctx.uid,
    metadata: { adminRole: AdminRole.SuperAdmin },
  });

  log.warn('first_admin_bootstrapped', { uid: ctx.uid });
  return { ok: true, adminRole: AdminRole.SuperAdmin };
}

export const bootstrapFirstAdmin = onCall(CALLABLE_OPTS, async (request) => {
  try {
    return await handleBootstrapFirstAdmin(request);
  } catch (err) {
    throw toHttpsError(err);
  }
});
