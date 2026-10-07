export type PostaInboxItem = {
  id: string;
  kind: 'contact' | 'imap' | 'bill';
  sourceId: string;
  at: string;
  from?: string;
  fromName?: string;
  to?: string | null;
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
};

export type PostaInboxFolder =
  | 'gelen'
  | 'tumu'
  | 'yildizli'
  | 'ertelenen'
  | 'spam'
  | 'arsiv'
  | 'cop'
  | 'fatura';

export type PostaComposeDraft = {
  id: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string | null;
  updatedAt: string;
};

export async function fetchPostaInbox(folder: PostaInboxFolder = 'gelen', limit = 80) {
  const res = await fetch(`/api/posta/inbox?folder=${folder}&limit=${limit}`);
  return res.json() as Promise<{
    ok: boolean;
    folder?: string;
    items?: PostaInboxItem[];
    imapConfigured?: boolean;
    error?: string;
  }>;
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
