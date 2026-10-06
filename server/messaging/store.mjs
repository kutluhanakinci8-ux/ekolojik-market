import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

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

export async function listMessagingThreads(dataDir, tenantId, { limit = 50, customerId } = {}) {
  const root = await ensureRoot(dataDir, tenantId);
  let threads = await readThreads(root);
  if (customerId) {
    threads = threads.filter((t) => t.customerId === customerId);
  }
  threads.sort((a, b) => Date.parse(b.updatedAt || b.createdAt) - Date.parse(a.updatedAt || a.createdAt));
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return { ok: true, threads: threads.slice(0, max) };
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
  const thread = {
    id: `em-${randomUUID()}`,
    customerId,
    customerName,
    customerEmail: String(payload.customerEmail ?? '').trim() || null,
    subject: String(payload.subject ?? '').trim() || `Müşteri: ${customerName}`,
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
  if (!bodyText) {
    return { ok: false, error: 'Mesaj metni zorunlu' };
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
    bodyText,
    authorName: String(payload.authorName ?? (direction === 'customer' ? 'Müşteri' : 'POS')).trim(),
    createdAt: new Date().toISOString(),
  };

  const messages = await readMessages(root, threadId);
  messages.push(message);
  await writeMessages(root, threadId, messages);

  const thread = threads[idx];
  thread.updatedAt = message.createdAt;
  thread.lastMessageAt = message.createdAt;
  thread.lastMessagePreview = preview(bodyText);
  thread.messageCount = (thread.messageCount ?? 0) + 1;
  threads[idx] = thread;
  await writeThreads(root, threads);

  return { ok: true, thread, message };
}
