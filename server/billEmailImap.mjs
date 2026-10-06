import { ImapFlow } from 'imapflow';

export function buildImapClient(config) {
  const host = String(config.imapHost || '').trim();
  const user = String(config.imapUser || config.inboxAddress || '').trim();
  const pass = String(config.imapPassword || '').trim();
  const port = Number(config.imapPort || 993);
  const secure = config.imapSecure !== false && port === 993;

  if (!host || !user || !pass) {
    throw new Error('IMAP host, kullanıcı ve şifre gerekli');
  }

  const local = host === '127.0.0.1' || host === 'localhost';
  const options = {
    host,
    port,
    secure,
    auth: { user, pass },
    logger: false,
  };
  if (local) {
    options.tls = { rejectUnauthorized: false };
  }

  return new ImapFlow(options);
}

export async function verifyImapMailbox(config) {
  const client = buildImapClient(config);
  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  try {
    const status = await client.status('INBOX', { messages: true, unseen: true });
    return {
      ok: true,
      message: `IMAP bağlantısı başarılı — ${config.imapUser || config.inboxAddress} (${status.messages ?? 0} mesaj, ${status.unseen ?? 0} okunmamış)`,
      mailboxCount: status.messages ?? 0,
      unseenCount: status.unseen ?? 0,
    };
  } finally {
    lock.release();
    await client.logout();
  }
}

function formatAddress(entry) {
  if (!entry) return '';
  if (typeof entry === 'string') return entry;
  if (entry.address) return entry.address;
  if (Array.isArray(entry)) return entry.map(formatAddress).filter(Boolean).join(', ');
  return '';
}

export async function fetchRecentInboxMessages(config, { sinceDate, maxMessages = 40 } = {}) {
  const client = buildImapClient(config);
  const since = sinceDate instanceof Date && Number.isFinite(sinceDate.getTime())
    ? sinceDate
    : new Date(Date.now() - 14 * 86400000);

  await client.connect();
  const lock = await client.getMailboxLock('INBOX');
  const collected = [];

  try {
    const uids = await client.search({ since }, { uid: true });
    const slice = uids.slice(-maxMessages);
    for await (const msg of client.fetch(slice, {
      uid: true,
      envelope: true,
      source: true,
      internalDate: true,
    })) {
      const from = formatAddress(msg.envelope?.from);
      const to = formatAddress(msg.envelope?.to);
      const subject = msg.envelope?.subject ?? '';
      const messageId = msg.envelope?.messageId ?? '';
      const receivedAt = (msg.internalDate ?? new Date()).toISOString();
      let rawSource = '';
      if (msg.source) {
        rawSource = msg.source.toString('utf8');
      }
      const text = rawSource.slice(0, 12000);
      const deliveredMatch = text.match(/^Delivered-To:\s*(.+)$/im);
      const deliveredTo = deliveredMatch?.[1]?.trim() ?? '';

      collected.push({
        imapUid: msg.uid,
        messageId,
        from,
        to,
        deliveredTo,
        subject,
        receivedAt,
        text,
        rawSource,
        snippet: text.replace(/\s+/g, ' ').trim().slice(0, 240),
      });
    }
  } finally {
    lock.release();
    await client.logout();
  }

  collected.sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  return collected;
}
