import nodemailer from 'nodemailer';
import { log } from '../../lib/logger';
import { getSmtpConfig, getSmtpPassword, isSmtpReady } from './store';
import type { SmtpPublicConfig } from './types';

export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

async function buildTransport(config: SmtpPublicConfig, password: string | null) {
  return nodemailer.createTransport({
    host: config.host.trim(),
    port: config.port,
    secure: config.secure,
    auth:
      config.username.trim() || password
        ? {
            user: config.username.trim() || config.fromEmail.trim(),
            pass: password ?? '',
          }
        : undefined,
  });
}

export async function sendPlatformMail(input: SendMailInput): Promise<{ ok: true }> {
  const ready = await isSmtpReady();
  if (!ready) {
    throw new Error('SMTP is not configured or not enabled');
  }
  const config = await getSmtpConfig();
  const password = await getSmtpPassword();
  const transport = await buildTransport(config, password);

  await transport.sendMail({
    from: `"${config.fromName.replace(/"/g, '')}" <${config.fromEmail}>`,
    replyTo: config.replyTo || config.fromEmail,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  log.info('smtp_mail_sent', { to: input.to, subject: input.subject });
  return { ok: true };
}

/** Verify SMTP credentials without sending a message body (EHLO + auth). */
export async function verifySmtpConnection(): Promise<{ ok: true }> {
  const config = await getSmtpConfig();
  if (!config.host.trim()) {
    throw new Error('SMTP host is required');
  }
  const password = await getSmtpPassword();
  const transport = await buildTransport(config, password);
  await transport.verify();
  return { ok: true };
}

/**
 * Fire-and-forget helper: never throws to callers. Logs failures.
 * Use for welcome / withdrawal notifications so ledger flows stay reliable.
 */
export async function sendMailSafe(
  input: SendMailInput,
  context: Record<string, unknown>,
): Promise<void> {
  try {
    await sendPlatformMail(input);
  } catch (err) {
    log.warn('smtp_mail_failed', {
      ...context,
      to: input.to,
      subject: input.subject,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
