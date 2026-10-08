import { getPostaInboxItemById, listUnifiedPostaInbox, listUnifiedPostaSent } from './postaInbox.mjs';

const HUB_FOLDER_ALIASES = {
  gelen: 'gelen',
  inbox: 'gelen',
  sent: 'gonderilen',
  gonderilen: 'gonderilen',
  drafts: 'taslaklar',
  taslaklar: 'taslaklar',
  junk: 'spam',
  spam: 'spam',
  trash: 'cop',
  cop: 'cop',
  fatura: 'fatura',
  arsiv: 'arsiv',
  yildizli: 'yildizli',
};

const JMAP_MAILBOXES = [
  { id: 'gelen', name: 'Gelen kutusu', role: 'inbox', sortOrder: 1 },
  { id: 'gonderilen', name: 'Gönderilen', role: 'sent', sortOrder: 2 },
  { id: 'taslaklar', name: 'Taslaklar', role: 'drafts', sortOrder: 3 },
  { id: 'spam', name: 'Spam', role: 'junk', sortOrder: 4 },
  { id: 'cop', name: 'Çöp', role: 'trash', sortOrder: 5 },
  { id: 'fatura', name: 'Fatura', role: null, sortOrder: 6 },
  { id: 'arsiv', name: 'Arşiv', role: 'archive', sortOrder: 7 },
  { id: 'yildizli', name: 'Yıldızlı', role: null, sortOrder: 8 },
];

function normalizeHubFolder(folder) {
  const raw = String(folder || 'gelen').trim().toLowerCase();
  return HUB_FOLDER_ALIASES[raw] ?? raw;
}

function mapItemToJmapEmail(item) {
  return {
    id: item.id,
    mailboxId: item.serverFolder ?? item.imapFolder ?? 'inbox',
    threadId: item.conversationId ?? item.threadId ?? item.id,
    subject: item.subject,
    from: item.from,
    to: item.to ?? null,
    receivedAt: item.at,
    preview: item.preview,
    unread: Boolean(item.unread),
    keywords: item.starred ? ['$flagged'] : [],
    hasAttachment: (item.attachments?.length ?? 0) > 0,
    bodyText: item.bodyText ?? '',
    bodyHtml: item.bodyHtml ?? '',
    serverFolder: item.serverFolder ?? item.imapFolder ?? null,
    kind: item.kind,
  };
}

/** NB JMAP yerine okuma köprüsü — tam protokol yok, REST uyumlu session. */
export function getPostaJmapLiteSession() {
  return {
    ok: true,
    capabilities: {
      'urn:ietf:params:jmap:core': {},
      'urn:ietf:params:jmap:mail': { maxSizeUpload: 10_485_760, readOnly: true },
      'ekolojik:posta:lite': {
        version: 2,
        note: 'IMAP hub REST köprüsü; tam Dovecot JMAP değil',
        methods: ['Mailbox/query', 'Email/query', 'Email/get'],
      },
    },
    apiUrl: '/api/posta/jmap-lite',
    downloadUrl: '/api/posta/inbox',
    uploadUrl: null,
  };
}

export function listPostaJmapLiteMailboxes() {
  const mailboxes = JMAP_MAILBOXES.map((m) => ({
    ...m,
    totalEmails: null,
    unreadEmails: null,
  }));
  return {
    ok: true,
    method: 'Mailbox/query',
    list: mailboxes.map((m) => m.id),
    mailboxes,
  };
}

export async function queryPostaJmapLiteMailbox(dataDir, tenantId, { folder = 'gelen', limit = 50 } = {}) {
  const hubFolder = normalizeHubFolder(folder);
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  let items = [];
  if (hubFolder === 'gonderilen') {
    const sent = await listUnifiedPostaSent(dataDir, tenantId, { limit: max });
    items = sent.items ?? [];
  } else {
    const inbox = await listUnifiedPostaInbox(dataDir, tenantId, { folder: hubFolder, limit: max });
    items = inbox.items ?? [];
  }
  const emails = items.map(mapItemToJmapEmail);
  return {
    ok: true,
    method: 'Email/query',
    folder: hubFolder,
    list: emails.map((e) => e.id),
    emails,
    total: emails.length,
  };
}

export async function getPostaJmapLiteEmails(dataDir, tenantId, ids = []) {
  const want = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  const emails = [];
  for (const id of want) {
    const hit = await getPostaInboxItemById(dataDir, tenantId, id);
    if (hit) emails.push(mapItemToJmapEmail(hit));
  }
  return {
    ok: true,
    method: 'Email/get',
    list: emails.map((e) => e.id),
    emails,
    notFound: want.filter((id) => !emails.some((e) => e.id === id)),
  };
}
