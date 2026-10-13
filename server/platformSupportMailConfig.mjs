/** Platform destek — destek@ ayrı posta kutusu (IMAP + giden kimlik) */

import { getEkolojikImapConfig, isEkolojikImapConfigured } from './ekolojikMailConfig.mjs';

const DEFAULT_SUPPORT_ADDRESS = 'destek@ekolojikmarket.com.tr';

export function getPlatformSupportMailAddress() {
  return process.env.EKOLOJIK_SUPPORT_MAIL_FROM?.trim()
    || process.env.EKOLOJIK_SUPPORT_INBOX?.trim()
    || DEFAULT_SUPPORT_ADDRESS;
}

export function getPlatformSupportImapConfig() {
  const fallback = getEkolojikImapConfig();
  const inbox = process.env.EKOLOJIK_SUPPORT_INBOX?.trim() || DEFAULT_SUPPORT_ADDRESS;
  return {
    imapHost: process.env.EKOLOJIK_SUPPORT_IMAP_HOST?.trim() || fallback.imapHost,
    imapPort: Number(process.env.EKOLOJIK_SUPPORT_IMAP_PORT || fallback.imapPort || 993),
    imapSecure: process.env.EKOLOJIK_SUPPORT_IMAP_SECURE !== '0',
    imapUser: process.env.EKOLOJIK_SUPPORT_IMAP_USER?.trim() || inbox,
    imapPassword: process.env.EKOLOJIK_SUPPORT_IMAP_PASS ?? fallback.imapPassword,
    inboxAddress: inbox,
  };
}

export function isPlatformSupportImapConfigured() {
  const c = getPlatformSupportImapConfig();
  return Boolean(c.imapHost && c.imapUser && c.imapPassword);
}

export function getPlatformSupportMailPresentation() {
  const from = getPlatformSupportMailAddress();
  return {
    from,
    fromName: process.env.EKOLOJIK_SUPPORT_MAIL_FROM_NAME?.trim() || 'Ekolojik Destek',
    replyTo: from,
  };
}

export function supportInboxStatus() {
  return {
    configured: isPlatformSupportImapConfigured(),
    address: getPlatformSupportMailAddress(),
    imapUser: getPlatformSupportImapConfig().imapUser,
    separateMailbox: true,
    autoreplyFrom: getPlatformSupportMailAddress(),
    fallbackToPlatformImap: !process.env.EKOLOJIK_SUPPORT_IMAP_USER?.trim() && isEkolojikImapConfigured(),
  };
}
