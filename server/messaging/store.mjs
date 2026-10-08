import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { saveMessageAttachments } from './attachments.mjs';

function messagingRoot(dataDir, tenantId = 'main') {
  return join(dataDir, 'messaging', tenantId);
}

async function ensureRoot(dataDir, tenantId) {
  const root = messagingRoot(dataDir, tenantId);
  await mkdir(join(root, 'messages'), { recursive: true });
  return root;
}

function threadsFile(root) {
  return join(root, 'threads.json');
}

function messagesFile(root, threadId) {
  const safe = String(threadId).replace(/[^a-zA-Z0-9_-]/g, '');
  return join(root, 'messages', `${safe}.json`);
}

async function readThreads(root) {
  try {
    const parsed = JSON.parse(await readFile(threadsFile(root), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.threads ?? [];
  } catch {
    return [];
  }
}

async function writeThreads(root, threads) {
  await writeFile(threadsFile(root), JSON.stringify(threads, null, 2), 'utf8');
}

async function readMessages(root, threadId) {
  try {
    const parsed = JSON.parse(await readFile(messagesFile(root, threadId), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.messages ?? [];
  } catch {
    return [];
  }
}

async function writeMessages(root, threadId, messages) {
  await writeFile(messagesFile(root, threadId), JSON.stringify(messages, null, 2), 'utf8');
}

function preview(text, max = 120) {
  const one = String(text ?? '').replace(/\s+/g, ' ').trim();
  return one.length <= max ? one : `${one.slice(0, max - 1)}…`;
}

function threadMatchesQuery(thread, q) {
  if (!q) return true;
  const hay = `${thread.subject} ${thread.customerName} ${thread.lastMessagePreview} ${thread.customerEmail ?? ''}`.toLowerCase();
  return hay.includes(q);
}

export async function listMessagingThreads(
  dataDir,
  tenantId,
  { limit = 50, customerId, q, includeArchived = false } = {},
) {
  const root = await ensureRoot(dataDir, tenantId);
  let threads = await readThreads(root);
  const query = String(q ?? '').trim().toLowerCase();
  if (customerId) {
    threads = threads.filter((t) => t.customerId === customerId);
  }
  if (!includeArchived) {
    threads = threads.filter((t) => !t.archived);
  }
  if (query) {
    threads = threads.filter((t) => threadMatchesQuery(t, query));
  }
  threads.sort((a, b) => {
    const pinA = a.pinned ? 1 : 0;
    const pinB = b.pinned ? 1 : 0;
    if (pinB !== pinA) return pinB - pinA;
    return Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt);
  });
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return { ok: true, threads: threads.slice(0, max) };
}

export async function patchMessagingThread(dataDir, tenantId, threadId, patch) {
  const root = await ensureRoot(dataDir, tenantId);
  const threads = await readThreads(root);
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx < 0) return { ok: false, error: 'Thread bulunamadı' };
  const row = threads[idx];
  if (patch.pinned != null) row.pinned = Boolean(patch.pinned);
  if (patch.archived != null) row.archived = Boolean(patch.archived);
  if (patch.muted != null) row.muted = Boolean(patch.muted);
  row.updatedAt = new Date().toISOString();
  threads[idx] = row;
  await writeThreads(root, threads);
  return { ok: true, thread: row };
}

export async function searchMessagingInThread(dataDir, tenantId, threadId, q, { limit = 100 } = {}) {
  const listed = await listMessagingMessages(dataDir, tenantId, threadId, { limit: 500 });
  if (!listed.ok) return listed;
  const query = String(q ?? '').trim().toLowerCase();
  if (!query) return listed;
  const messages = (listed.messages ?? []).filter((m) =>
    `${m.bodyText} ${m.authorName}`.toLowerCase().includes(query),
  );
  const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return { ok: true, thread: listed.thread, messages: messages.slice(-max), query };
}

export async function getMessagingThread(dataDir, tenantId, threadId) {
  const root = await ensureRoot(dataDir, tenantId);
  const threads = await readThreads(root);
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return { ok: false, error: 'Thread bulunamadı' };
  return { ok: true, thread };
}

export async function createMessagingThread(dataDir, tenantId, payload) {
  const customerId = String(payload.customerId ?? '').trim();
  const customerName = String(payload.customerName ?? '').trim() || 'Müşteri';
  if (!customerId) {
    return { ok: false, error: 'customerId zorunlu' };
  }

  const root = await ensureRoot(dataDir, tenantId);
  const threads = await readThreads(root);
  const now = new Date().toISOString();
  const channel = String(payload.channel ?? 'web').trim().toLowerCase() || 'web';
  const thread = {
    id: `em-${randomUUID()}`,
    customerId,
    customerName,
    customerEmail: String(payload.customerEmail ?? '').trim() || null,
    subject: String(payload.subject ?? '').trim() || `Müşteri: ${customerName}`,
    channel,
    externalId: payload.externalId ? String(payload.externalId).trim() : null,
    status: 'open',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
    lastMessagePreview: '',
    messageCount: 0,
  };

  threads.unshift(thread);
  await writeThreads(root, threads);
  await writeMessages(root, thread.id, []);

  const initial = String(payload.initialMessage ?? '').trim();
  if (initial) {
    return appendMessagingMessage(dataDir, tenantId, thread.id, {
      bodyText: initial,
      direction: payload.initialDirection ?? 'staff',
      authorName: payload.authorName ?? 'POS',
    });
  }

  return { ok: true, thread };
}

export async function listMessagingMessages(dataDir, tenantId, threadId, { limit = 100 } = {}) {
  const got = await getMessagingThread(dataDir, tenantId, threadId);
  if (!got.ok) return got;
  const root = messagingRoot(dataDir, tenantId);
  const messages = await readMessages(root, threadId);
  const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
  return { ok: true, thread: got.thread, messages: messages.slice(-max) };
}

export async function appendMessagingMessage(dataDir, tenantId, threadId, payload) {
  const bodyText = String(payload.bodyText ?? '').trim();
  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0;
  if (!bodyText && !hasAttachments) {
    return { ok: false, error: 'Mesaj metni veya ek zorunlu' };
  }

  const root = await ensureRoot(dataDir, tenantId);
  const threads = await readThreads(root);
  const idx = threads.findIndex((t) => t.id === threadId);
  if (idx < 0) {
    return { ok: false, error: 'Thread bulunamadı' };
  }

  const direction = payload.direction === 'customer' ? 'customer' : 'staff';
  const message = {
    id: `msg-${randomUUID()}`,
    threadId,
    direction,
    bodyText: bodyText || (hasAttachments ? '(ek dosya)' : ''),
    authorName: String(payload.authorName ?? (direction === 'customer' ? 'Müşteri' : 'POS')).trim(),
    createdAt: new Date().toISOString(),
    readByStaffAt: null,
    readByCustomerAt: null,
    attachments: [],
  };

  if (hasAttachments) {
    try {
      message.attachments = await saveMessageAttachments(
        dataDir,
        tenantId,
        message.id,
        payload.attachments,
      );
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Ek kaydedilemedi',
      };
    }
  }

  const messages = await readMessages(root, threadId);
  messages.push(message);
  await writeMessages(root, threadId, messages);

  const thread = threads[idx];
  thread.updatedAt = message.createdAt;
  thread.lastMessageAt = message.createdAt;
  thread.lastMessagePreview = preview(bodyText || message.attachments[0]?.fileName || '');
  thread.messageCount = (thread.messageCount ?? 0) + 1;
  thread.lastMessageDirection = direction;
  if (direction === 'staff') {
    thread.staffLastReadAt = message.createdAt;
  }
  threads[idx] = thread;
  await writeThreads(root, threads);

  if (direction === 'staff' && thread.channel && thread.channel !== 'web') {
    try {
      const { dispatchStaffMessageToExternalChannel } = await import('./omnichannel.mjs');
      await dispatchStaffMessageToExternalChannel(dataDir, tenantId, thread, message);
    } catch {
      /* harici kanal opsiyonel */
    }
  }

  return { ok: true, thread, message };
}

export async function markMessagingMessagesRead(
  dataDir,
  tenantId,
  threadId,
  { reader = 'staff', messageId } = {},
) {
  const party = reader === 'customer' ? 'customer' : 'staff';
  const root = await ensureRoot(dataDir, tenantId);
  const got = await getMessagingThread(dataDir, tenantId, threadId);
  if (!got.ok) return got;

  const messages = await readMessages(root, threadId);
  const now = new Date().toISOString();
  let changed = 0;

  const touch = (m) => {
    if (party === 'staff' && m.direction === 'customer' && !m.readByStaffAt) {
      m.readByStaffAt = now;
      changed += 1;
    }
    if (party === 'customer' && m.direction === 'staff' && !m.readByCustomerAt) {
      m.readByCustomerAt = now;
      changed += 1;
    }
  };

  if (messageId) {
    const one = messages.find((m) => m.id === messageId);
    if (one) touch(one);
  } else {
    for (const m of messages) touch(m);
  }

  if (changed > 0) await writeMessages(root, threadId, messages);

  const threads = await readThreads(root);
  const idx = threads.findIndex((t) => t.id === threadId);
  let threadRow = got.thread;
  if (idx >= 0) {
    if (party === 'staff') threads[idx].staffLastReadAt = now;
    else threads[idx].customerLastReadAt = now;
    threadRow = threads[idx];
    await writeThreads(root, threads);
  }

  return { ok: true, thread: threadRow, updated: changed };
}

export async function markMessagingThreadStaffRead(dataDir, tenantId, threadId) {
  return markMessagingMessagesRead(dataDir, tenantId, threadId, { reader: 'staff' });
}

export async function markMessagingThreadCustomerRead(dataDir, tenantId, threadId, opts = {}) {
  return markMessagingMessagesRead(dataDir, tenantId, threadId, {
    reader: 'customer',
    messageId: opts.messageId,
  });
}

export async function countStaffUnreadMessagingThreads(dataDir, tenantId = 'main') {
  const root = messagingRoot(dataDir, tenantId);
  let threads = [];
  try {
    threads = await readThreads(root);
  } catch {
    return 0;
  }
  let count = 0;
  for (const t of threads) {
    if (t.archived) continue;
    if (t.lastMessageDirection !== 'customer') continue;
    const readAt = t.staffLastReadAt ? Date.parse(t.staffLastReadAt) : 0;
    const lastAt = Date.parse(t.lastMessageAt || t.updatedAt || 0);
    if (!Number.isFinite(lastAt)) continue;
    if (!readAt || readAt < lastAt) count += 1;
  }
  return count;
}
