import { listUnifiedPostaInbox } from './postaInbox.mjs';

/** NB JMAP yerine okuma köprüsü — tam protokol yok, REST uyumlu session. */
export function getPostaJmapLiteSession() {
  return {
    ok: true,
    capabilities: {
      'urn:ietf:params:jmap:core': {},
      'urn:ietf:params:jmap:mail': { maxSizeUpload: 10_485_760 },
      'ekolojik:posta:lite': { version: 1, note: 'IMAP hub REST köprüsü; tam Dovecot JMAP değil' },
    },
    apiUrl: '/api/posta/jmap-lite',
    downloadUrl: '/api/posta/inbox',
    uploadUrl: null,
  };
}

export async function queryPostaJmapLiteMailbox(dataDir, tenantId, { folder = 'gelen', limit = 50 } = {}) {
  const inbox = await listUnifiedPostaInbox(dataDir, tenantId, { folder, limit });
  const emails = (inbox.items ?? []).map((item) => ({
    id: item.id,
    threadId: item.conversationId ?? item.id,
    subject: item.subject,
    from: item.from,
    receivedAt: item.at,
    preview: item.preview,
    unread: Boolean(item.unread),
    keywords: item.starred ? ['$flagged'] : [],
  }));
  return {
    ok: true,
    method: 'Email/query',
    list: emails.map((e) => e.id),
    emails,
    total: emails.length,
  };
}
