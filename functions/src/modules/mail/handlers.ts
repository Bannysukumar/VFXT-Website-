import { onCall } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { CALLABLE_OPTS, toHttpsError } from '../../lib/callable';
import { AppError } from '../../lib/errors';
import { AdminRole, requireAdminRole } from '../../lib/permissions';
import { log } from '../../lib/logger';
import { writeAuditLog } from '../audit/handlers';
import { sendPlatformMail, verifySmtpConnection } from './mailer';
import { sendPasswordResetViaSmtp } from './notify';
import { getSmtpAdminView, saveSmtpSettings } from './store';
import { smtpTestEmail } from './templates';

const smtpPatchSchema = z
  .object({
    enabled: z.boolean().optional(),
    host: z.string().max(200).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    secure: z.boolean().optional(),
    username: z.string().max(200).optional(),
    /** Omit or empty string to keep the existing password. */
    password: z.string().max(500).optional(),
    fromEmail: z.string().email().max(200).optional(),
    fromName: z.string().max(120).optional(),
    replyTo: z.string().email().max(200).optional().or(z.literal('')),
    sendWelcome: z.boolean().optional(),
    sendWithdrawalStatus: z.boolean().optional(),
    sendPasswordReset: z.boolean().optional(),
  })
  .strict();

export const getAdminSmtpSettings = onCall(CALLABLE_OPTS, async (request) => {
  try {
    requireAdminRole(request, [AdminRole.SuperAdmin, AdminRole.OperationsAdmin]);
    return await getSmtpAdminView();
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const updateSmtpSettings = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin, AdminRole.OperationsAdmin]);
    const parsed = smtpPatchSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', parsed.error.issues[0]?.message ?? 'Invalid SMTP settings');
    }

    const patch = { ...parsed.data };
    if (patch.password !== undefined && patch.password.length === 0) {
      delete patch.password;
    }

    const next = await saveSmtpSettings(patch, ctx.uid);
    await writeAuditLog({
      actorId: ctx.uid,
      action: 'smtp.update',
      resourceType: 'smtp',
      resourceId: 'smtp',
      metadata: {
        enabled: next.enabled,
        host: next.host,
        fromEmail: next.fromEmail,
        passwordChanged: Boolean(parsed.data.password),
      },
    });
    return next;
  } catch (err) {
    throw toHttpsError(err);
  }
});

export const testSmtpSettings = onCall(CALLABLE_OPTS, async (request) => {
  try {
    const ctx = requireAdminRole(request, [AdminRole.SuperAdmin, AdminRole.OperationsAdmin]);
    const toSchema = z
      .object({
        to: z.string().email().max(200).optional(),
      })
      .strict();
    const parsed = toSchema.safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', 'Invalid test email address');
    }

    await verifySmtpConnection();

    const view = await getSmtpAdminView();
    const to = parsed.data.to?.trim() || request.auth?.token?.email || view.fromEmail;
    if (!to || !to.includes('@')) {
      throw new AppError('invalid-argument', 'Provide a destination email for the test message');
    }

    const mail = smtpTestEmail();
    await sendPlatformMail({
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    });

    await writeAuditLog({
      actorId: ctx.uid,
      action: 'smtp.test',
      resourceType: 'smtp',
      resourceId: 'smtp',
      metadata: { to },
    });

    return { ok: true as const, to };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'SMTP test failed';
    throw toHttpsError(new AppError('failed-precondition', message));
  }
});

/**
 * Public password-reset: prefers platform SMTP; returns fallback hint when SMTP is off.
 * Always returns a generic ok so we do not leak whether the email exists.
 */
export const requestPasswordReset = onCall(CALLABLE_OPTS, async (request) => {
  try {
    // Allow unauthenticated callers (forgot-password flow).
    const parsed = z
      .object({ email: z.string().email().max(200) })
      .safeParse(request.data ?? {});
    if (!parsed.success) {
      throw new AppError('invalid-argument', 'Enter a valid email address');
    }

    const email = parsed.data.email.trim().toLowerCase();
    try {
      const sent = await sendPasswordResetViaSmtp(email);
      if (sent) {
        log.info('password_reset_smtp_sent', { email });
        return { ok: true as const, via: 'smtp' as const };
      }
    } catch (err) {
      // User-not-found → still pretend success. Other SMTP errors → fall back.
      const message = err instanceof Error ? err.message : String(err);
      if (/user-not-found|no user record/i.test(message)) {
        return { ok: true as const, via: 'smtp' as const };
      }
      log.warn('password_reset_smtp_failed', { email, error: message });
    }

    return { ok: true as const, via: 'client_fallback' as const };
  } catch (err) {
    throw toHttpsError(err);
  }
});
