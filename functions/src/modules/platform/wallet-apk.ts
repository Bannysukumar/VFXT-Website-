import { FieldValue } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { AppError } from '../../lib/errors';
import { Collections, getDb } from '../../lib/firebase';
import { AdminRole, requireAdminRole } from '../../lib/permissions';
import { writeAuditLog } from '../audit/handlers';

const WALLET_APK_DOC = 'walletApk';

export type WalletApkRelease = {
  versionName: string;
  versionCode: number;
  fileName: string;
  downloadUrl: string;
  storagePath: string;
  sizeBytes: number;
  notes: string;
  sha256?: string;
  publishedAt?: FirebaseFirestore.Timestamp | FirebaseFirestore.FieldValue;
  publishedBy?: string;
};

const publishSchema = z.object({
  versionName: z.string().min(1).max(40),
  versionCode: z.number().int().positive().max(1_000_000_000),
  fileName: z.string().min(5).max(120).regex(/\.apk$/i),
  downloadUrl: z.string().url().max(2000),
  storagePath: z
    .string()
    .min(10)
    .max(300)
    .regex(/^public\/wallet-apk\/.+\.apk$/i),
  sizeBytes: z.number().int().positive().max(80 * 1024 * 1024),
  notes: z.string().max(2000).default(''),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});

export async function readWalletApkRelease(): Promise<WalletApkRelease | null> {
  const snap = await getDb().collection(Collections.config).doc(WALLET_APK_DOC).get();
  if (!snap.exists) return null;
  return snap.data() as WalletApkRelease;
}

/** Public: latest published VFXT Wallet Android APK metadata. */
export const getWalletApkRelease = onCall(CALLABLE_OPTS, async () => {
  try {
    const release = await readWalletApkRelease();
    if (!release) {
      return { available: false as const };
    }
    return {
      available: true as const,
      versionName: release.versionName,
      versionCode: release.versionCode,
      fileName: release.fileName,
      downloadUrl: release.downloadUrl,
      sizeBytes: release.sizeBytes,
      notes: release.notes ?? '',
      sha256: release.sha256 ?? null,
      publishedAt:
        release.publishedAt && typeof (release.publishedAt as { toDate?: () => Date }).toDate === 'function'
          ? (release.publishedAt as FirebaseFirestore.Timestamp).toDate().toISOString()
          : null,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Admin: publish metadata after uploading the APK to Storage. */
export const publishWalletApk = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const admin = requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
      AdminRole.FinanceAdmin,
    ]);
    const parsed = publishSchema.safeParse(request.data);
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid APK metadata');
    }

    const data = parsed.data;
    if (!data.downloadUrl.includes('wallet-apk')) {
      throw new AppError('invalid-argument', 'Download URL must point at the wallet-apk storage path.');
    }

    const payload: WalletApkRelease = {
      versionName: data.versionName.trim(),
      versionCode: data.versionCode,
      fileName: data.fileName.trim(),
      downloadUrl: data.downloadUrl.trim(),
      storagePath: data.storagePath.trim(),
      sizeBytes: data.sizeBytes,
      notes: (data.notes ?? '').trim(),
      ...(data.sha256 ? { sha256: data.sha256.toLowerCase() } : {}),
      publishedAt: FieldValue.serverTimestamp(),
      publishedBy: admin.uid,
    };

    await getDb().collection(Collections.config).doc(WALLET_APK_DOC).set(payload, { merge: true });
    await writeAuditLog({
      actorId: admin.uid,
      action: 'wallet_apk.publish',
      resourceType: 'config',
      resourceId: WALLET_APK_DOC,
      metadata: {
        versionName: payload.versionName,
        versionCode: payload.versionCode,
        fileName: payload.fileName,
        sizeBytes: payload.sizeBytes,
      },
    });

    return {
      ok: true as const,
      versionName: payload.versionName,
      versionCode: payload.versionCode,
      downloadUrl: payload.downloadUrl,
    };
  } catch (err) {
    throw toHttpsError(err);
  }
});

/** Admin: clear the published release (does not delete the Storage object). */
export const unpublishWalletApk = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const admin = requireAdminRole(request, [
      AdminRole.SuperAdmin,
      AdminRole.OperationsAdmin,
    ]);
    await getDb().collection(Collections.config).doc(WALLET_APK_DOC).delete();
    await writeAuditLog({
      actorId: admin.uid,
      action: 'wallet_apk.unpublish',
      resourceType: 'config',
      resourceId: WALLET_APK_DOC,
    });
    return { ok: true as const };
  } catch (err) {
    throw toHttpsError(err);
  }
});
