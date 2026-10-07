export type MessagingThread = {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail?: string | null;
  subject: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  messageCount: number;
  lastMessageDirection?: 'staff' | 'customer';
  staffLastReadAt?: string | null;
  pinned?: boolean;
  archived?: boolean;
  muted?: boolean;
};

export type MessagingAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  url: string;
};

export type MessagingMessage = {
  id: string;
  threadId: string;
  direction: 'staff' | 'customer';
  bodyText: string;
  authorName: string;
  createdAt: string;
  attachments?: MessagingAttachment[];
};

function tenantQuery(tenant?: string) {
  if (!tenant || tenant === 'main') return '';
  return `?tenant=${encodeURIComponent(tenant)}`;
}

export async function fetchMessagingThreads(params: {
  customerId?: string;
  limit?: number;
  tenant?: string;
  q?: string;
  includeArchived?: boolean;
}): Promise<{ ok: boolean; threads?: MessagingThread[]; error?: string }> {
  const q = new URLSearchParams();
  if (params.customerId) q.set('customerId', params.customerId);
  if (params.limit) q.set('limit', String(params.limit));
  if (params.q?.trim()) q.set('q', params.q.trim());
  if (params.includeArchived) q.set('includeArchived', '1');
  if (params.tenant && params.tenant !== 'main') q.set('tenant', params.tenant);
  const qs = q.toString();
  const res = await fetch(`/api/messaging/threads${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function createMessagingThread(payload: {
  customerId: string;
  customerName: string;
  customerEmail?: string;
  subject?: string;
  initialMessage?: string;
  initialDirection?: 'staff' | 'customer';
  authorName?: string;
  tenant?: string;
}): Promise<{ ok: boolean; thread?: MessagingThread; error?: string }> {
  const res = await fetch(`/api/messaging/threads${tenantQuery(payload.tenant)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function fetchMessagingMessages(
  threadId: string,
  params?: { limit?: number; tenant?: string; q?: string },
): Promise<{ ok: boolean; thread?: MessagingThread; messages?: MessagingMessage[]; error?: string }> {
  const q = new URLSearchParams();
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.q?.trim()) q.set('q', params.q.trim());
  if (params?.tenant && params.tenant !== 'main') q.set('tenant', params.tenant);
  const qs = q.toString();
  const res = await fetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/messages${qs ? `?${qs}` : ''}`);
  return res.json();
}

export async function markMessagingThreadRead(threadId: string) {
  const res = await fetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/read`, { method: 'POST' });
  return res.json() as Promise<{ ok: boolean }>;
}

export async function patchMessagingThreadFlags(
  threadId: string,
  flags: { pinned?: boolean; archived?: boolean; muted?: boolean },
) {
  const res = await fetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/flags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(flags),
  });
  return res.json() as Promise<{ ok: boolean; thread?: MessagingThread; error?: string }>;
}

export async function postMessagingMessage(
  threadId: string,
  payload: {
    bodyText: string;
    direction?: 'staff' | 'customer';
    authorName?: string;
    tenant?: string;
    attachments?: Array<{ fileName: string; mimeType: string; dataBase64: string }>;
  },
): Promise<{ ok: boolean; message?: MessagingMessage; thread?: MessagingThread; error?: string }> {
  const res = await fetch(`/api/messaging/threads/${encodeURIComponent(threadId)}/messages${tenantQuery(payload.tenant)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
