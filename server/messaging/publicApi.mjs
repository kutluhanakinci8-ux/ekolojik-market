import { createHash } from 'node:crypto';
import {
  appendMessagingMessage,
  createMessagingThread,
  getMessagingThread,
  listMessagingMessages,
  markMessagingThreadCustomerRead,
} from './store.mjs';
import { getMessagingTyping, setMessagingTyping } from './realtime.mjs';
import { isMessagingPublicApiConfigured, resolveEffectiveMessagingPublicKey } from './publicConfig.mjs';

export async function getMessagingPublicCapabilities(dataDir, tenantId = 'main') {
  const configured = await isMessagingPublicApiConfigured(dataDir, tenantId);
  const resolved = await resolveEffectiveMessagingPublicKey(dataDir, tenantId);
  return {
    ok: true,
    version: 1,
    apiPrefix: '/api/public/messaging/v1',
    auth: 'x-ekolojik-messaging-key or Authorization Bearer',
    tenantId,
    configured,
    keySource: resolved.source,
  };
}

export async function assertMessagingPublicAuth(req, dataDir, tenantId = 'main') {
  const resolved = await resolveEffectiveMessagingPublicKey(dataDir, tenantId);
  const expected = resolved.key;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'Public messaging API kapalı (tenant anahtarı veya EKOLOJIK_MESSAGING_PUBLIC_KEY)',
    };
  }
  const header =
    req.headers['x-ekolojik-messaging-key'] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!header || header !== expected) {
    return { ok: false, status: 401, error: 'Geçersiz messaging API anahtarı' };
  }
  return { ok: true };
}

async function secretForTenant(dataDir, tenantId) {
  const resolved = await resolveEffectiveMessagingPublicKey(dataDir, tenantId);
  return resolved.key || 'dev';
}

export async function mintCustomerThreadToken(dataDir, tenantId, threadId, customerId) {
  const secret = await secretForTenant(dataDir, tenantId);
  const payload = `${threadId}:${customerId}`;
  const sig = createHash('sha256').update(`${secret}:${payload}`).digest('hex').slice(0, 24);
  return `${Buffer.from(payload, 'utf8').toString('base64url')}.${sig}`;
}

export async function parseCustomerThreadToken(dataDir, tenantId, token) {
  const raw = String(token ?? '').trim();
  const [body, sig] = raw.split('.');
  if (!body || !sig) return { ok: false, error: 'Geçersiz token' };
  try {
    const decoded = Buffer.from(body, 'base64url').toString('utf8');
    const [threadId, customerId] = decoded.split(':');
    if (!threadId || !customerId) return { ok: false, error: 'Token içeriği hatalı' };
    const full = await mintCustomerThreadToken(dataDir, tenantId, threadId, customerId);
    const expected = full.split('.')[1];
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
    customerToken: await mintCustomerThreadToken(dataDir, tenantId, result.thread.id, customerId),
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

export { generateMessagingPublicKey } from './publicConfig.mjs';

/** Onboarding / admin smoke — public API ile thread açar */
export async function smokeTestMessagingWidget(dataDir, tenantId = 'main') {
  const configured = await isMessagingPublicApiConfigured(dataDir, tenantId);
  if (!configured) {
    return { ok: false, error: 'Public messaging anahtarı yapılandırılmadı' };
  }
  const stamp = Date.now();
  return publicCreateThread(dataDir, tenantId, {
    customerId: `widget-smoke-${stamp}`,
    customerName: 'Widget test',
    customerEmail: null,
    subject: 'Widget bağlantı testi',
    initialMessage: 'Otomatik onboarding widget testi — bu mesajı POS Sohbet’te görebilirsiniz.',
    authorName: 'Widget test',
  });
}
