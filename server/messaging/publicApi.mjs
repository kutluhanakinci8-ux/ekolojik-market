import { createHash, randomBytes } from 'node:crypto';
import {
  appendMessagingMessage,
  createMessagingThread,
  getMessagingThread,
  listMessagingMessages,
  markMessagingThreadCustomerRead,
} from './store.mjs';
import { getMessagingTyping, setMessagingTyping } from './realtime.mjs';

export function getMessagingPublicCapabilities() {
  return {
    ok: true,
    version: 1,
    apiPrefix: '/api/public/messaging/v1',
    auth: 'x-ekolojik-messaging-key or Authorization Bearer',
    configured: Boolean(resolvePublicMessagingKey()),
  };
}

function resolvePublicMessagingKey() {
  return process.env.EKOLOJIK_MESSAGING_PUBLIC_KEY?.trim() || '';
}

export function assertMessagingPublicAuth(req) {
  const expected = resolvePublicMessagingKey();
  if (!expected) {
    return { ok: false, status: 503, error: 'Public messaging API kapalı (EKOLOJIK_MESSAGING_PUBLIC_KEY)' };
  }
  const header =
    req.headers['x-ekolojik-messaging-key'] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!header || header !== expected) {
    return { ok: false, status: 401, error: 'Geçersiz messaging API anahtarı' };
  }
  return { ok: true };
}

export function mintCustomerThreadToken(threadId, customerId) {
  const secret = resolvePublicMessagingKey() || 'dev';
  const payload = `${threadId}:${customerId}`;
  const sig = createHash('sha256').update(`${secret}:${payload}`).digest('hex').slice(0, 24);
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`;
}

export function parseCustomerThreadToken(token) {
  const raw = String(token ?? '').trim();
  const [body, sig] = raw.split('.');
  if (!body || !sig) return { ok: false, error: 'Geçersiz token' };
  try {
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    const [threadId, customerId] = decoded.split(':');
    if (!threadId || !customerId) return { ok: false, error: 'Token içeriği hatalı' };
    const expected = mintCustomerThreadToken(threadId, customerId).split('.')[1];
    if (sig !== expected) return { ok: false, error: 'Token imzası geçersiz' };
    return { ok: true, threadId, customerId };
  } catch {
    return { ok: false, error: 'Token çözülemedi' };
  }
}

export async function publicCreateThread(dataDir, tenantId, payload) {
  const customerId = String(payload.customerId ?? '').trim();
  if (!customerId) return { ok: false, error: 'customerId zorunlu' };
  const result = await createMessagingThread(dataDir, tenantId, {
    customerId,
    customerName: payload.customerName,
    customerEmail: payload.customerEmail,
    subject: payload.subject,
    initialMessage: payload.initialMessage,
    initialDirection: 'customer',
    authorName: payload.authorName ?? 'Müşteri',
  });
  if (!result.ok || !result.thread) return result;
  return {
    ok: true,
    thread: result.thread,
    message: result.message ?? null,
    customerToken: mintCustomerThreadToken(result.thread.id, customerId),
  };
}

export async function publicListMessages(dataDir, tenantId, threadId, customerId, { limit = 100 } = {}) {
  const thread = await getMessagingThread(dataDir, tenantId, threadId);
  if (!thread.ok) return thread;
  if (thread.thread.customerId !== customerId) {
    return { ok: false, error: 'Thread erişimi reddedildi' };
  }
  const listed = await listMessagingMessages(dataDir, tenantId, threadId, { limit });
  await markMessagingThreadCustomerRead(dataDir, tenantId, threadId);
  return listed;
}

export async function publicPostMessage(dataDir, tenantId, threadId, customerId, payload) {
  const thread = await getMessagingThread(dataDir, tenantId, threadId);
  if (!thread.ok) return thread;
  if (thread.thread.customerId !== customerId) {
    return { ok: false, error: 'Thread erişimi reddedildi' };
  }
  return appendMessagingMessage(dataDir, tenantId, threadId, {
    bodyText: payload.bodyText,
    direction: 'customer',
    authorName: payload.authorName ?? 'Müşteri',
    attachments: payload.attachments,
  });
}

export async function publicTyping(dataDir, tenantId, threadId, customerId, active) {
  const thread = await getMessagingThread(dataDir, tenantId, threadId);
  if (!thread.ok) return thread;
  if (thread.thread.customerId !== customerId) {
    return { ok: false, error: 'Thread erişimi reddedildi' };
  }
  return { ok: true, typing: setMessagingTyping(tenantId, threadId, 'customer', Boolean(active)) };
}

export function generateMessagingPublicKey() {
  return randomBytes(24).toString('base64url');
}
