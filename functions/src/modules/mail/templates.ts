const APP_ORIGIN =
  (typeof process.env.PUBLIC_APP_URL === 'string' && process.env.PUBLIC_APP_URL.trim()) ||
  'https://virtualfxtrades.com';

/** Brand palette — inline only (email clients strip <style> reliably). */
const C = {
  ink: '#0B1220',
  muted: '#5B6B7C',
  soft: '#8A97A6',
  line: '#E6ECF2',
  canvas: '#EEF3F8',
  card: '#FFFFFF',
  brand: '#0D9488',
  brandDark: '#0F766E',
  brandDeep: '#115E59',
  brandSoft: '#CCFBF1',
  navy: '#0B1F33',
  gold: '#D4A017',
  success: '#059669',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  warning: '#B45309',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
} as const;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function ctaButton(href: string, label: string, tone: 'brand' | 'success' | 'danger' = 'brand'): string {
  const bg =
    tone === 'success' ? C.success : tone === 'danger' ? C.danger : C.brandDark;
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;">
  <tr>
    <td align="center" bgcolor="${bg}" style="border-radius:10px;background:${bg};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

function detailRow(label: string, value: string, last = false): string {
  const border = last ? 'none' : `1px solid ${C.line}`;
  return `<tr>
  <td style="padding:12px 0;border-bottom:${border};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${C.soft};width:34%;vertical-align:top;">
    ${escapeHtml(label)}
  </td>
  <td style="padding:12px 0;border-bottom:${border};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;color:${C.ink};word-break:break-all;vertical-align:top;">
    ${value}
  </td>
</tr>`;
}

function statusBadge(
  label: string,
  tone: 'success' | 'danger' | 'warning' | 'brand',
): string {
  const map = {
    success: { bg: C.successBg, fg: C.success, bd: C.successBorder },
    danger: { bg: C.dangerBg, fg: C.danger, bd: C.dangerBorder },
    warning: { bg: C.warningBg, fg: C.warning, bd: C.warningBorder },
    brand: { bg: C.brandSoft, fg: C.brandDeep, bd: '#99F6E4' },
  } as const;
  const t = map[tone];
  return `<span style="display:inline-block;padding:6px 12px;border-radius:999px;background:${t.bg};border:1px solid ${t.bd};color:${t.fg};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;">${escapeHtml(label)}</span>`;
}

function layout(opts: {
  title: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  bodyHtml: string;
  accent?: string;
}): string {
  const accent = opts.accent ?? C.brand;
  const year = new Date().getUTCFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(opts.title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background:${C.canvas};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;mso-hide:all;">
    ${escapeHtml(opts.preheader)}
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${C.canvas};">
    <tr>
      <td align="center" style="padding:28px 14px 40px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;">
          <tr>
            <td align="center" style="padding:0 0 18px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;color:${C.soft};">
              Virtual FX Trades · secure account mail
            </td>
          </tr>
          <tr>
            <td style="background:${C.card};border-radius:18px;overflow:hidden;border:1px solid ${C.line};box-shadow:0 12px 40px rgba(11,31,51,0.08);">
              <!-- Header -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="background:${C.navy};padding:0;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      <tr>
                        <td style="height:4px;line-height:4px;font-size:0;background:${accent};">&nbsp;</td>
                      </tr>
                      <tr>
                        <td style="padding:22px 28px 20px;">
                          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                            <tr>
                              <td valign="middle">
                                <span style="display:inline-block;width:36px;height:36px;border-radius:10px;background:linear-gradient(145deg,${C.brand} 0%,${C.brandDeep} 100%);background-color:${C.brand};text-align:center;line-height:36px;font-family:Georgia,Times New Roman,serif;font-size:16px;font-weight:700;color:#ffffff;vertical-align:middle;">V</span>
                                <span style="display:inline-block;margin-left:12px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;vertical-align:middle;">Virtual FX Trades</span>
                              </td>
                              <td align="right" valign="middle">
                                <span style="display:inline-block;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,0.18);color:rgba(255,255,255,0.78);font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">VFXT</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Hero -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:28px 28px 8px;background:linear-gradient(180deg,#F7FBFA 0%,#FFFFFF 70%);background-color:#ffffff;">
                    <p style="margin:0 0 8px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${accent};">
                      ${escapeHtml(opts.eyebrow)}
                    </p>
                    <h1 style="margin:0;font-family:Georgia,Times New Roman,serif;font-size:26px;line-height:1.25;font-weight:700;color:${C.ink};letter-spacing:-0.02em;">
                      ${escapeHtml(opts.headline)}
                    </h1>
                  </td>
                </tr>
              </table>

              <!-- Body -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:8px 28px 32px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:${C.muted};">
                    ${opts.bodyHtml}
                  </td>
                </tr>
              </table>

              <!-- Footer strip -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="padding:20px 28px 24px;background:#F8FAFC;border-top:1px solid ${C.line};">
                    <p style="margin:0 0 8px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${C.muted};">
                      Need help? Reply to this email or visit
                      <a href="${APP_ORIGIN}/support" style="color:${C.brandDark};font-weight:600;text-decoration:none;">Support</a>.
                    </p>
                    <p style="margin:0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${C.soft};">
                      <a href="${APP_ORIGIN}" style="color:${C.soft};text-decoration:none;">virtualfxtrades.com</a>
                      · <a href="${APP_ORIGIN}/app" style="color:${C.soft};text-decoration:none;">Member app</a>
                      · <a href="${APP_ORIGIN}/auth/login" style="color:${C.soft};text-decoration:none;">Sign in</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:20px 8px 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;line-height:1.6;color:${C.soft};">
              © ${year} Virtual FX Trades. All rights reserved.<br />
              This message was sent regarding your VFXT account activity.
            </td>
          </tr>
        </table>
      </td>
    </tr>
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
  const codeBlock = params.referralCode
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 8px;">
        <tr>
          <td style="padding:16px 18px;border-radius:12px;background:${C.brandSoft};border:1px solid #99F6E4;">
            <p style="margin:0 0 6px;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:${C.brandDeep};">Your User ID</p>
            <p style="margin:0;font-family:Consolas,Menlo,Monaco,monospace;font-size:22px;font-weight:700;letter-spacing:0.06em;color:${C.ink};">${escapeHtml(params.referralCode)}</p>
            <p style="margin:8px 0 0;font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:12px;color:${C.muted};">Share this ID so others can transfer funds to you.</p>
          </td>
        </tr>
      </table>`
    : '';

  const html = layout({
    title: subject,
    preheader: `Your Virtual FX Trades account is ready${params.referralCode ? ` — ID ${params.referralCode}` : ''}.`,
    eyebrow: 'Account created',
    headline: `Welcome aboard, ${name}`,
    accent: C.brand,
    bodyHtml: `
      <p style="margin:16px 0 0;color:${C.muted};">Your account for <strong style="color:${C.ink};">${escapeHtml(params.email)}</strong> is ready.</p>
      <p style="margin:12px 0 0;color:${C.muted};">Deposit VFXT, stake for daily ROI, and grow with the affiliate network — all from your member dashboard.</p>
      ${codeBlock}
      ${ctaButton(`${APP_ORIGIN}/auth/login`, 'Sign in to your account', 'brand')}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:8px;">
        <tr>
          <td width="33%" style="padding:10px 8px 0 0;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.ink};">Deposit</p>
            <p style="margin:0;font-size:12px;color:${C.soft};">Fund your wallet securely</p>
          </td>
          <td width="33%" style="padding:10px 8px 0;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.ink};">Stake</p>
            <p style="margin:0;font-size:12px;color:${C.soft};">Earn daily ROI in VFXT</p>
          </td>
          <td width="33%" style="padding:10px 0 0 8px;vertical-align:top;">
            <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:${C.ink};">Refer</p>
            <p style="margin:0;font-size:12px;color:${C.soft};">Build your network income</p>
          </td>
        </tr>
      </table>
    `,
  });

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
  const isOk = params.status === 'completed';
  const statusLabel =
    params.status === 'completed'
      ? 'Successful'
      : params.status === 'rejected'
        ? 'Rejected'
        : 'Failed';
  const tone = isOk ? 'success' : params.status === 'rejected' ? 'warning' : 'danger';
  const accent = isOk ? C.success : params.status === 'rejected' ? C.warning : C.danger;
  const subject = `Withdrawal ${statusLabel.toLowerCase()} — Virtual FX Trades`;
  const headline = isOk
    ? 'Your withdrawal was sent'
    : params.status === 'rejected'
      ? 'Withdrawal was rejected'
      : 'Withdrawal could not be completed';
  const intro = isOk
    ? 'Good news — your payout has been processed successfully.'
    : 'Here is an update on your recent withdrawal request.';

  const rows: string[] = [
    detailRow('Status', statusBadge(statusLabel, tone)),
    detailRow('Amount', escapeHtml(params.amountLabel), !params.destination && !params.txHash && !params.reason),
  ];
  if (params.destination) {
    rows.push(
      detailRow(
        'Destination',
        `<span style="font-family:Consolas,Menlo,Monaco,monospace;font-size:13px;">${escapeHtml(params.destination)}</span>`,
        !params.txHash && !params.reason,
      ),
    );
  }
  if (params.txHash) {
    rows.push(
      detailRow(
        'Tx hash',
        `<span style="font-family:Consolas,Menlo,Monaco,monospace;font-size:12px;">${escapeHtml(params.txHash)}</span>`,
        !params.reason,
      ),
    );
  }
  if (params.reason) {
    rows.push(detailRow('Details', escapeHtml(params.reason), true));
  }

  const html = layout({
    title: subject,
    preheader: `Withdrawal ${statusLabel.toLowerCase()} · ${params.amountLabel}`,
    eyebrow: 'Withdrawal update',
    headline,
    accent,
    bodyHtml: `
      <p style="margin:16px 0 0;">Hi <strong style="color:${C.ink};">${escapeHtml(name)}</strong>,</p>
      <p style="margin:10px 0 0;">${intro}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:22px 0 4px;background:#F8FAFC;border:1px solid ${C.line};border-radius:14px;">
        <tr>
          <td style="padding:6px 18px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              ${rows.join('')}
            </table>
          </td>
        </tr>
      </table>
      ${ctaButton(
        `${APP_ORIGIN}/app/withdrawals`,
        'View withdrawals',
        isOk ? 'success' : 'brand',
      )}
    `,
  });

  const text = [
    `Hi ${name},`,
    '',
    `Withdrawal ${statusLabel.toLowerCase()}.`,
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
  const html = layout({
    title: subject,
    preheader: 'Use this secure link to choose a new password. It expires soon.',
    eyebrow: 'Security',
    headline: 'Reset your password',
    accent: C.brand,
    bodyHtml: `
      <p style="margin:16px 0 0;">We received a request to reset the password for</p>
      <p style="margin:6px 0 0;"><strong style="color:${C.ink};">${escapeHtml(params.email)}</strong></p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0 4px;">
        <tr>
          <td style="padding:14px 16px;border-radius:12px;background:${C.warningBg};border:1px solid ${C.warningBorder};font-family:Segoe UI,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${C.warning};">
            This link expires soon. If you did not request a reset, you can safely ignore this email — your password will stay the same.
          </td>
        </tr>
      </table>
      ${ctaButton(escapeHtml(params.resetLink), 'Reset password', 'brand')}
      <p style="margin:18px 0 0;font-size:12px;color:${C.soft};">Button not working? Copy and paste this URL into your browser:</p>
      <p style="margin:6px 0 0;font-family:Consolas,Menlo,Monaco,monospace;font-size:11px;line-height:1.5;color:${C.brandDark};word-break:break-all;">
        ${escapeHtml(params.resetLink)}
      </p>
    `,
  });

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

/** Professional HTML used by the admin “Send test” action. */
export function smtpTestEmail(): { subject: string; html: string; text: string } {
  const subject = 'VFXT SMTP test — Virtual FX Trades';
  const html = layout({
    title: subject,
    preheader: 'Your SMTP connection is working. Outbound mail from support@ is ready.',
    eyebrow: 'SMTP diagnostics',
    headline: 'Test email delivered',
    accent: C.brand,
    bodyHtml: `
      <p style="margin:16px 0 0;">This is a test message from the <strong style="color:${C.ink};">Virtual FX Trades</strong> admin SMTP settings page.</p>
      <p style="margin:12px 0 0;">If you received this, outbound mail from <strong style="color:${C.ink};">support@virtualfxtrades.com</strong> is configured correctly.</p>
      ${ctaButton(`${APP_ORIGIN}/admin/smtp`, 'Open SMTP settings', 'brand')}
    `,
  });
  const text =
    'This is a test email from Virtual FX Trades admin SMTP settings. Outbound mail is working.';
  return { subject, html, text };
}

export { APP_ORIGIN };
