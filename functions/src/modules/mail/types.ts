import type { FieldValue, Timestamp } from 'firebase-admin/firestore';

/** Non-secret SMTP config stored in config/smtp. Password lives in secrets/smtp. */
export interface SmtpPublicConfig {
  enabled: boolean;
  host: string;
  port: number;
  /** true = TLS on connect (usually port 465); false = STARTTLS (usually 587). */
  secure: boolean;
  username: string;
  fromEmail: string;
  fromName: string;
  replyTo: string;
  sendWelcome: boolean;
  sendWithdrawalStatus: boolean;
  sendPasswordReset: boolean;
  updatedAt?: Timestamp | FieldValue;
  updatedBy?: string;
}

export interface SmtpSecretRecord {
  password: string;
  updatedAt?: Timestamp | FieldValue;
  updatedBy?: string;
}

/** Safe payload for admin UI (never returns the raw password). */
export interface SmtpAdminView extends SmtpPublicConfig {
  passwordSet: boolean;
}

export const DEFAULT_SMTP_CONFIG: SmtpPublicConfig = {
  enabled: false,
  host: '',
  port: 587,
  secure: false,
  username: '',
  fromEmail: 'support@virtualfxtrades.com',
  fromName: 'Virtual FX Trades',
  replyTo: 'support@virtualfxtrades.com',
  sendWelcome: true,
  sendWithdrawalStatus: true,
  sendPasswordReset: true,
};
