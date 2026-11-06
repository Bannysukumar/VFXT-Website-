import { Collections, getAdminAuth, getDb } from '../../lib/firebase';
import { log } from '../../lib/logger';
import { sendMailSafe, sendPlatformMail } from './mailer';
import { getSmtpConfig, isSmtpReady } from './store';
import {
  APP_ORIGIN,
  passwordResetEmail,
  welcomeEmail,
  withdrawalStatusEmail,
} from './templates';

async function loadUserMailContext(userId: string): Promise<{
  email: string | null;
  displayName: string | null;
  referralCode: string | null;
}> {
  const snap = await getDb().collection(Collections.users).doc(userId).get();
  if (!snap.exists) return { email: null, displayName: null, referralCode: null };
  const data = snap.data() ?? {};
  const email = typeof data.email === 'string' && data.email.includes('@') ? data.email : null;
  return {
    email,
    displayName: typeof data.displayName === 'string' ? data.displayName : null,
    referralCode: typeof data.referralCode === 'string' ? data.referralCode : null,
  };
}

export async function sendWelcomeEmailForUser(params: {
  userId: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<void> {
  try {
    const config = await getSmtpConfig();
    if (!config.sendWelcome || !(await isSmtpReady())) return;

    let email = params.email ?? null;
    let displayName = params.displayName ?? null;
    let referralCode: string | null = null;

    const ctx = await loadUserMailContext(params.userId);
    email = email ?? ctx.email;
    displayName = displayName ?? ctx.displayName;
    referralCode = ctx.referralCode;
    if (!email) return;

    const mail = welcomeEmail({ email, displayName, referralCode });
    await sendMailSafe({ to: email, ...mail }, { kind: 'welcome', userId: params.userId });
  } catch (err) {
    log.warn('welcome_email_skipped', {
      userId: params.userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendWithdrawalStatusEmail(params: {
  userId: string;
  status: 'completed' | 'failed' | 'rejected';
  amountMinor: number;
  currency?: string;
  destination?: string | null;
  txHash?: string | null;
  reason?: string | null;
}): Promise<void> {
  try {
    const config = await getSmtpConfig();
    if (!config.sendWithdrawalStatus || !(await isSmtpReady())) return;

    const ctx = await loadUserMailContext(params.userId);
    if (!ctx.email) return;

    const currency = params.currency ?? 'VFXT';
    const amountLabel = `${Number(params.amountMinor || 0).toLocaleString()} ${currency}`;
    const mail = withdrawalStatusEmail({
      displayName: ctx.displayName,
      status: params.status,
      amountLabel,
      destination: params.destination ?? null,
      txHash: params.txHash ?? null,
      reason: params.reason ?? null,
    });
    await sendMailSafe(
      { to: ctx.email, ...mail },
      { kind: 'withdrawal_status', userId: params.userId, status: params.status },
    );
  } catch (err) {
    log.warn('withdrawal_email_skipped', {
      userId: params.userId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Send password-reset via SMTP using Firebase Admin reset link.
 * Returns false when SMTP path is unavailable (caller may fall back).
 */
export async function sendPasswordResetViaSmtp(email: string): Promise<boolean> {
  const config = await getSmtpConfig();
  if (!config.sendPasswordReset || !(await isSmtpReady())) {
    return false;
  }

  const normalized = email.trim().toLowerCase();
  const link = await getAdminAuth().generatePasswordResetLink(normalized, {
    url: `${APP_ORIGIN}/auth/login`,
    handleCodeInApp: false,
  });
  const mail = passwordResetEmail({ email: normalized, resetLink: link });
  await sendPlatformMail({ to: normalized, ...mail });
  return true;
}
