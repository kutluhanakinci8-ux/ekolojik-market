import { appendMessagingMessage, createMessagingThread } from './store.mjs';
import { sendWhatsAppText } from '../integrations/whatsappCloud.mjs';

async function readAllThreads(dataDir, tenantId) {
  const { listMessagingThreads } = await import('./store.mjs');
  const listed = await listMessagingThreads(dataDir, tenantId, { limit: 200, includeArchived: true });
  return listed.threads ?? [];
}

export async function findThreadByExternal(dataDir, tenantId, channel, externalId) {
  const threads = await readAllThreads(dataDir, tenantId);
  return threads.find(
    (t) => t.channel === channel && t.externalId === externalId && !t.archived,
  );
}

export async function ensureChannelThread(
  dataDir,
  tenantId,
  { channel, externalId, customerId, customerName, customerEmail, subject },
) {
  const existing = await findThreadByExternal(dataDir, tenantId, channel, externalId);
  if (existing) return { ok: true, thread: existing, created: false };
  const created = await createMessagingThread(dataDir, tenantId, {
    customerId,
    customerName,
    customerEmail,
    subject: subject ?? `${channel} — ${customerName}`,
    channel,
    externalId,
  });
  return { ...created, created: true };
}

const recentInbound = new Map();

export async function ingestInboundChannelMessage(
  dataDir,
  tenantId,
  {
    channel,
    externalId,
    customerId,
    customerName,
    bodyText,
    authorName,
    idempotencyKey,
  },
) {
  const key = `${tenantId}:${idempotencyKey ?? `${channel}:${externalId}:${bodyText}`}`;
  if (recentInbound.has(key)) return { ok: true, duplicate: true };
  recentInbound.set(key, Date.now());
  if (recentInbound.size > 500) {
    const cutoff = Date.now() - 3600_000;
    for (const [k, t] of recentInbound) {
      if (t < cutoff) recentInbound.delete(k);
    }
  }

  const ensured = await ensureChannelThread(dataDir, tenantId, {
    channel,
    externalId,
    customerId,
    customerName,
    subject: `${channel === 'whatsapp' ? 'WhatsApp' : channel} — ${customerName}`,
  });
  if (!ensured.ok || !ensured.thread) return ensured;

  return appendMessagingMessage(dataDir, tenantId, ensured.thread.id, {
    bodyText,
    direction: 'customer',
    authorName,
  });
}

export async function dispatchStaffMessageToExternalChannel(dataDir, tenantId, thread, message) {
  if (!thread?.channel || thread.channel === 'web') return { skipped: true };
  if (thread.channel === 'whatsapp' && thread.externalId?.startsWith('wa:')) {
    const waId = thread.externalId.slice(3);
    return sendWhatsAppText(waId, message.bodyText);
  }
  return { skipped: true, reason: 'unsupported_channel' };
}
