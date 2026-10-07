export type PostaInboxItem = {
  id: string;
  kind: 'contact' | 'imap' | 'bill' | 'outbox' | 'imap-sent';
  sourceId: string;
  at: string;
  from?: string;
  fromName?: string;
  to?: string | null;
  cc?: string | null;
  subject: string;
  preview: string;
  unread: boolean;
  archived: boolean;
  bodyText: string;
  bodyHtml?: string;
  messageId?: string | null;
  attachments?: Array<{ id: string; fileName: string; mimeType?: string; size?: number }>;
  amount?: number | null;
  dueDate?: string | null;
  matched?: boolean;
  starred?: boolean;
  spam?: boolean;
  trashed?: boolean;
  snoozedUntil?: string | null;
  snoozeActive?: boolean;
  imapFolder?: string;
  status?: string;
  folder?: string;
  lastError?: string | null;
  inReplyTo?: string | null;
  references?: string | null;
};

export type PostaConversationItem = {
  id: string;
  kind: 'conversation';
  threadId: string;
  subject: string;
  preview: string;
  at: string;
  from?: string;
  fromName?: string;
  unread: boolean;
  starred?: boolean;
  count: number;
  messages: PostaInboxItem[];
  sourceId?: string;
};

export type PostaListItem = PostaInboxItem | PostaConversationItem;

export function isPostaConversationItem(row: PostaListItem): row is PostaConversationItem {
  return row.kind === 'conversation';
}

export type PostaInboxQuery = {
  q?: string;
  listMode?: 'message' | 'conversation';
  unread?: boolean;
  starred?: boolean;
  hasAttachment?: boolean;
};

export type PostaInboxFolder =
  | 'gelen'
  | 'tumu'
  | 'yildizli'
  | 'ertelenen'
  | 'spam'
  | 'arsiv'
  | 'cop'
  | 'fatura'
  | 'taslaklar';

export type PostaComposeDraft = {
  id: string;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  bodyFormat?: 'markdown' | 'html';
  inReplyTo?: string | null;
  references?: string | null;
  updatedAt: string;
};

const OFFLINE_INBOX_PREFIX = 'ekolojik-posta-inbox-offline-v1';

function inboxOfflineKey(folder: string, params: URLSearchParams) {
  return `${OFFLINE_INBOX_PREFIX}:${folder}:${params.toString()}`;
}

function saveInboxOffline(key: string, payload: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), payload }));
  } catch {
    /* quota */
  }
}

function loadInboxOffline(key: string) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as { at: number; payload: Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function fetchPostaInbox(
  folder: PostaInboxFolder = 'gelen',
  limit = 80,
  query: PostaInboxQuery = {},
) {
  const params = new URLSearchParams({ folder, limit: String(limit) });
  if (query.q?.trim()) params.set('q', query.q.trim());
  if (query.listMode) params.set('listMode', query.listMode);
  if (query.unread) params.set('unread', '1');
  if (query.starred) params.set('starred', '1');
  if (query.hasAttachment) params.set('hasAttachment', '1');
  const cacheKey = inboxOfflineKey(folder, params);
  try {
    const res = await fetch(`/api/posta/inbox?${params.toString()}`);
    const data = await res.json();
    if (data?.ok) saveInboxOffline(cacheKey, data);
    return data as {
      ok: boolean;
      folder?: string;
      listMode?: 'message' | 'conversation';
      items?: PostaListItem[];
      imapConfigured?: boolean;
      offline?: boolean;
      cachedAt?: number;
      error?: string;
    };
  } catch {
    const cached = loadInboxOffline(cacheKey);
    if (cached?.payload) {
      return {
        ...(cached.payload as object),
        ok: true,
        offline: true,
        cachedAt: cached.at,
      } as {
        ok: boolean;
        folder?: string;
        listMode?: 'message' | 'conversation';
        items?: PostaListItem[];
        imapConfigured?: boolean;
        offline?: boolean;
        cachedAt?: number;
        error?: string;
      };
    }
    return { ok: false, error: 'Ağ hatası — önbellek yok' };
  }
}

export async function syncPostaInboxImap() {
  const res = await fetch('/api/posta/inbox/sync', { method: 'POST' });
  return res.json() as Promise<{ ok: boolean; message?: string; error?: string; added?: number }>;
}

export async function markPostaInboxRead(payload: { id: string; kind: string; sourceId?: string }) {
  const res = await fetch('/api/posta/inbox/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export async function archivePostaInboxItem(payload: { id: string; kind: string; sourceId?: string }) {
  const res = await fetch('/api/posta/inbox/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export async function fetchPostaUnreadCounts() {
  const res = await fetch('/api/posta/unread-counts');
  return res.json() as Promise<{ ok: boolean; total?: number; gelen?: number; fatura?: number }>;
}

export type MailTemplate = { id: string; label: string; subject: string; body: string };

export async function fetchPostaTemplates() {
  const res = await fetch('/api/posta/templates');
  return res.json() as Promise<{ ok: boolean; templates?: MailTemplate[] }>;
}

export async function fetchComposeRecipientHints() {
  const res = await fetch('/api/posta/compose-hints?limit=50');
  return res.json() as Promise<{ ok: boolean; emails?: string[] }>;
}

export async function patchPostaInboxFlags(payload: {
  id: string;
  starred?: boolean;
  spam?: boolean;
  trashed?: boolean;
  snoozedUntil?: string | null;
}) {
  const res = await fetch('/api/posta/inbox/flags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; error?: string; flags?: Record<string, unknown> }>;
}

export async function fetchPostaComposeDrafts() {
  const res = await fetch('/api/posta/drafts');
  return res.json() as Promise<{ ok: boolean; drafts?: PostaComposeDraft[]; error?: string }>;
}

export async function savePostaComposeDraft(draft: Partial<PostaComposeDraft> & { to?: string; subject?: string; body?: string }) {
  const res = await fetch('/api/posta/drafts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(draft),
  });
  return res.json() as Promise<{ ok: boolean; draft?: PostaComposeDraft; error?: string }>;
}

export async function deletePostaComposeDraft(id: string) {
  const res = await fetch(`/api/posta/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export type PostaStorageSummary = {
  usedBytes: number;
  quotaBytes: number;
  percent: number;
  maxAttachmentBytes: number;
  breakdown?: Record<string, number>;
};

export async function fetchPostaStorage() {
  const res = await fetch('/api/posta/storage');
  return res.json() as Promise<{ ok: boolean; error?: string } & Partial<PostaStorageSummary>>;
}

export type PostaInboxBatchItem = { id: string; kind: string; sourceId?: string };

export async function batchPostaInboxAction(
  action: 'read' | 'archive' | 'spam' | 'trash',
  items: PostaInboxBatchItem[],
) {
  const res = await fetch('/api/posta/inbox/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, items }),
  });
  return res.json() as Promise<{ ok: boolean; processed?: number; failed?: number; error?: string }>;
}

export async function markAllPostaInboxRead(folder: PostaInboxFolder = 'gelen') {
  const res = await fetch('/api/posta/inbox/mark-all-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder }),
  });
  return res.json() as Promise<{ ok: boolean; processed?: number; error?: string }>;
}

export async function fetchPostaSent(limit = 80) {
  const res = await fetch(`/api/posta/sent?limit=${limit}`);
  return res.json() as Promise<{ ok: boolean; items?: PostaInboxItem[]; imapConfigured?: boolean; error?: string }>;
}
