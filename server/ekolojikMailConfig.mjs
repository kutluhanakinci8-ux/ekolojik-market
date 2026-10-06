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

export function getEkolojikImapConfig() {
  return {
    imapHost: process.env.EKOLOJIK_IMAP_HOST?.trim() || '',
    imapPort: Number(process.env.EKOLOJIK_IMAP_PORT || 993),
    imapSecure: process.env.EKOLOJIK_IMAP_SECURE !== '0',
    imapUser: process.env.EKOLOJIK_IMAP_USER?.trim() || process.env.EKOLOJIK_IMAP_INBOX?.trim() || '',
    imapPassword: process.env.EKOLOJIK_IMAP_PASS ?? '',
    inboxAddress: process.env.EKOLOJIK_IMAP_INBOX?.trim() || '',
  };
}

export function isEkolojikImapConfigured() {
  const c = getEkolojikImapConfig();
  return Boolean(c.imapHost && c.imapUser && c.imapPassword);
}

/** VPS IP ile SMTP denemesi — Postfix yoksa ECONNREFUSED */
export function getEkolojikSmtpHostHint() {
  const host = process.env.EKOLOJIK_SMTP_HOST?.trim() || '';
  if (!host) return 'EKOLOJIK_SMTP_HOST tanımlayın (ör. mail.ekolojikmarket.com.tr)';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return 'SMTP host olarak VPS IP kullanılıyor — genelde mail.ekolojikmarket.com.tr veya relay gerekir';
  }
  if (host === 'localhost' || host === '127.0.0.1') {
    return 'localhost SMTP — üretimde mail.ekolojikmarket.com.tr önerilir';
  }
  return null;
}

/** Operasyon / iletişim formu bildirimleri (Faz 2) */
export function getEkolojikOpsEmail() {
  const explicit = process.env.EKOLOJIK_OPS_EMAIL?.trim();
  if (explicit?.includes('@')) return explicit;
  const c = getEkolojikMailConfig();
  if (c.replyTo?.includes('@')) return c.replyTo;
  return c.from?.includes('@') ? c.from : '';
}

export function buildFromHeader(fromName, fromEmail) {
  if (fromName && fromEmail) {
    return `"${fromName.replace(/"/g, '\\"')}" <${fromEmail}>`;
  }
  return fromEmail;
}
