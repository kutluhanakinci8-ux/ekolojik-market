/** Ekolojik Market — bağımsız giden posta (Nakliye Borsası ile paylaşılmaz) */

export function getEkolojikMailConfig() {
  const from = process.env.EKOLOJIK_MAIL_FROM?.trim() || process.env.CRM_EMAIL_FROM?.trim() || '';
  return {
    smtpHost: process.env.EKOLOJIK_SMTP_HOST?.trim() || '',
    smtpPort: Number(process.env.EKOLOJIK_SMTP_PORT || 587),
    smtpSecure: process.env.EKOLOJIK_SMTP_SECURE === '1' || process.env.EKOLOJIK_SMTP_PORT === '465',
    smtpUser: process.env.EKOLOJIK_SMTP_USER?.trim() || '',
    smtpPass: process.env.EKOLOJIK_SMTP_PASS ?? '',
    from,
    fromName: process.env.EKOLOJIK_MAIL_FROM_NAME?.trim() || 'Ekolojik Market',
    replyTo: process.env.EKOLOJIK_MAIL_REPLY_TO?.trim() || from,
  };
}

export function isEkolojikSmtpConfigured() {
  const c = getEkolojikMailConfig();
  return Boolean(c.smtpHost && c.from && c.from.includes('@'));
}

export function buildFromHeader(fromName, fromEmail) {
  if (fromName && fromEmail) {
    return `"${fromName.replace(/"/g, '\\"')}" <${fromEmail}>`;
  }
  return fromEmail;
}
