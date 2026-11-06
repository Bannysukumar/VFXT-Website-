const APP_ORIGIN =
  (typeof process.env.PUBLIC_APP_URL === 'string' && process.env.PUBLIC_APP_URL.trim()) ||
  'https://virtualfxtrades.com';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Arial,sans-serif;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="background:#0f766e;padding:20px 28px;color:#fff;font-size:18px;font-weight:600;">Virtual FX Trades</td></tr>
        <tr><td style="padding:28px;">${bodyHtml}</td></tr>
        <tr><td style="padding:16px 28px 24px;font-size:12px;color:#6b7280;border-top:1px solid #eef2f7;">
          Need help? Reply to this email or visit <a href="${APP_ORIGIN}/support" style="color:#0f766e;">Support</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function welcomeEmail(params: {
  displayName?: string | null;
  email: string;
  referralCode?: string | null;
}): { subject: string; html: string; text: string } {
  const name = params.displayName?.trim() || 'there';
  const subject = 'Welcome to Virtual FX Trades';
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;">Hi ${escapeHtml(name)},</p>
     <p style="margin:0 0 12px;line-height:1.5;">Your account is ready. Sign in to deposit, stake, and track income.</p>
     ${
       params.referralCode
         ? `<p style="margin:0 0 12px;line-height:1.5;">Your User ID / referral code: <strong>${escapeHtml(params.referralCode)}</strong></p>`
         : ''
     }
     <p style="margin:24px 0 0;"><a href="${APP_ORIGIN}/auth/login" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Sign in</a></p>`,
  );
  const text = [
    `Hi ${name},`,
    '',
    'Welcome to Virtual FX Trades. Your account is ready.',
    params.referralCode ? `Your User ID / referral code: ${params.referralCode}` : '',
    '',
    `Sign in: ${APP_ORIGIN}/auth/login`,
  ]
    .filter(Boolean)
    .join('\n');
  return { subject, html, text };
}

export function withdrawalStatusEmail(params: {
  displayName?: string | null;
  status: 'completed' | 'failed' | 'rejected';
  amountLabel: string;
  destination?: string | null;
  txHash?: string | null;
  reason?: string | null;
}): { subject: string; html: string; text: string } {
  const name = params.displayName?.trim() || 'there';
  const statusLabel =
    params.status === 'completed'
      ? 'successful'
      : params.status === 'rejected'
        ? 'rejected'
        : 'failed';
  const subject = `Withdrawal ${statusLabel} — Virtual FX Trades`;
  const details: string[] = [
    `<p style="margin:0 0 8px;"><strong>Status:</strong> ${escapeHtml(statusLabel)}</p>`,
    `<p style="margin:0 0 8px;"><strong>Amount:</strong> ${escapeHtml(params.amountLabel)}</p>`,
  ];
  if (params.destination) {
    details.push(
      `<p style="margin:0 0 8px;"><strong>Destination:</strong> ${escapeHtml(params.destination)}</p>`,
    );
  }
  if (params.txHash) {
    details.push(
      `<p style="margin:0 0 8px;"><strong>Tx hash:</strong> ${escapeHtml(params.txHash)}</p>`,
    );
  }
  if (params.reason) {
    details.push(
      `<p style="margin:0 0 8px;"><strong>Details:</strong> ${escapeHtml(params.reason)}</p>`,
    );
  }
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;">Hi ${escapeHtml(name)},</p>
     <p style="margin:0 0 16px;line-height:1.5;">An update on your withdrawal:</p>
     ${details.join('')}
     <p style="margin:24px 0 0;"><a href="${APP_ORIGIN}/app/withdrawals" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">View withdrawals</a></p>`,
  );
  const text = [
    `Hi ${name},`,
    '',
    `Withdrawal ${statusLabel}.`,
    `Amount: ${params.amountLabel}`,
    params.destination ? `Destination: ${params.destination}` : '',
    params.txHash ? `Tx hash: ${params.txHash}` : '',
    params.reason ? `Details: ${params.reason}` : '',
    '',
    `View: ${APP_ORIGIN}/app/withdrawals`,
  ]
    .filter(Boolean)
    .join('\n');
  return { subject, html, text };
}

export function passwordResetEmail(params: {
  email: string;
  resetLink: string;
}): { subject: string; html: string; text: string } {
  const subject = 'Reset your Virtual FX Trades password';
  const html = layout(
    subject,
    `<p style="margin:0 0 12px;font-size:16px;">Password reset requested</p>
     <p style="margin:0 0 12px;line-height:1.5;">We received a request to reset the password for <strong>${escapeHtml(params.email)}</strong>.</p>
     <p style="margin:0 0 16px;line-height:1.5;">This link expires soon. If you did not request it, you can ignore this email.</p>
     <p style="margin:24px 0 0;"><a href="${escapeHtml(params.resetLink)}" style="display:inline-block;background:#0f766e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Reset password</a></p>`,
  );
  const text = [
    'Password reset requested for Virtual FX Trades.',
    '',
    `Account: ${params.email}`,
    '',
    `Reset link: ${params.resetLink}`,
    '',
    'If you did not request this, ignore this email.',
  ].join('\n');
  return { subject, html, text };
}

export { APP_ORIGIN };
