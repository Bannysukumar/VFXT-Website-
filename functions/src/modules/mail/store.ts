import { FieldValue } from 'firebase-admin/firestore';
import { Collections, getDb } from '../../lib/firebase';
import {
  DEFAULT_SMTP_CONFIG,
  type SmtpAdminView,
  type SmtpPublicConfig,
  type SmtpSecretRecord,
} from './types';

const SMTP_CONFIG_DOC = 'smtp';
const SMTP_SECRET_DOC = 'smtp';

function mergeConfig(raw: Partial<SmtpPublicConfig> | undefined): SmtpPublicConfig {
  return {
    ...DEFAULT_SMTP_CONFIG,
    ...(raw ?? {}),
    enabled: Boolean(raw?.enabled ?? DEFAULT_SMTP_CONFIG.enabled),
    host: String(raw?.host ?? DEFAULT_SMTP_CONFIG.host),
    port: Number(raw?.port ?? DEFAULT_SMTP_CONFIG.port) || 587,
    secure: Boolean(raw?.secure ?? DEFAULT_SMTP_CONFIG.secure),
    username: String(raw?.username ?? DEFAULT_SMTP_CONFIG.username),
    fromEmail: String(raw?.fromEmail ?? DEFAULT_SMTP_CONFIG.fromEmail),
    fromName: String(raw?.fromName ?? DEFAULT_SMTP_CONFIG.fromName),
    replyTo: String(raw?.replyTo ?? DEFAULT_SMTP_CONFIG.replyTo),
    sendWelcome: raw?.sendWelcome !== false,
    sendWithdrawalStatus: raw?.sendWithdrawalStatus !== false,
    sendPasswordReset: raw?.sendPasswordReset !== false,
  };
}

export async function getSmtpConfig(): Promise<SmtpPublicConfig> {
  const snap = await getDb().collection(Collections.config).doc(SMTP_CONFIG_DOC).get();
  if (!snap.exists) return structuredClone(DEFAULT_SMTP_CONFIG);
  // Ignore any legacy `password` field that may still exist on the public config doc.
  const raw = { ...(snap.data() as Record<string, unknown>) };
  delete raw.password;
  return mergeConfig(raw as Partial<SmtpPublicConfig>);
}

export async function getSmtpPassword(): Promise<string | null> {
  const snap = await getDb().collection(Collections.secrets).doc(SMTP_SECRET_DOC).get();
  if (snap.exists) {
    const password = (snap.data() as SmtpSecretRecord)?.password;
    if (typeof password === 'string' && password.length > 0) return password;
  }
  // Legacy fallback: password was once written onto config/smtp (world-readable).
  // Prefer secrets; migrate on read so mail keeps working until scrub script runs.
  const legacy = await getDb().collection(Collections.config).doc(SMTP_CONFIG_DOC).get();
  const legacyPassword = legacy.exists ? (legacy.data() as { password?: unknown })?.password : null;
  if (typeof legacyPassword === 'string' && legacyPassword.length > 0) {
    await getDb()
      .collection(Collections.secrets)
      .doc(SMTP_SECRET_DOC)
      .set(
        {
          password: legacyPassword,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: 'legacy-migrate',
        } satisfies SmtpSecretRecord,
        { merge: true },
      );
    await getDb()
      .collection(Collections.config)
      .doc(SMTP_CONFIG_DOC)
      .set({ password: FieldValue.delete() }, { merge: true });
    return legacyPassword;
  }
  return null;
}

export async function getSmtpAdminView(): Promise<SmtpAdminView> {
  const config = await getSmtpConfig();
  const password = await getSmtpPassword();
  return { ...config, passwordSet: Boolean(password) };
}

export async function saveSmtpSettings(
  patch: Partial<SmtpPublicConfig> & { password?: string },
  actorId: string,
): Promise<SmtpAdminView> {
  const current = await getSmtpConfig();
  const next: SmtpPublicConfig = mergeConfig({
    ...current,
    ...patch,
  });
  next.updatedAt = FieldValue.serverTimestamp();
  next.updatedBy = actorId;

  const db = getDb();
  // Never persist the password on config/smtp (client rules must deny this doc anyway).
  const publicPayload: Record<string, unknown> = { ...next, password: FieldValue.delete() };
  await db.collection(Collections.config).doc(SMTP_CONFIG_DOC).set(publicPayload, { merge: true });

  const password = typeof patch.password === 'string' ? patch.password : undefined;
  if (password !== undefined && password.length > 0) {
    const secret: SmtpSecretRecord = {
      password,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorId,
    };
    await db.collection(Collections.secrets).doc(SMTP_SECRET_DOC).set(secret, { merge: true });
  }

  return getSmtpAdminView();
}

export async function isSmtpReady(): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config.enabled) return false;
  if (!config.host.trim() || !config.fromEmail.trim()) return false;
  const password = await getSmtpPassword();
  // Some relays allow empty password (IP auth); still require username or password presence.
  if (!config.username.trim() && !password) return false;
  return true;
}
