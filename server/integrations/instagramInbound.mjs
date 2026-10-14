/** Instagram / Meta messaging webhook (lite) — generic JSON payload */

import { ingestInboundChannelMessage } from '../messaging/omnichannel.mjs';

function resolveSecret(req) {
  const header = req?.headers?.['x-ekolojik-instagram-secret'] ?? req?.headers?.['x-hub-signature-256'];
  const expected = process.env.EKOLOJIK_INSTAGRAM_INBOUND_SECRET?.trim();
  if (!expected) return true;
  const got = String(header ?? '').trim();
  return got === expected || got.endsWith(expected);
}

export async function handleInstagramInboundWebhook(dataDir, tenantId, { method, body, req, query }) {
  if (method === 'GET') {
    const challenge = query?.get?.('hub.challenge') ?? body?.hub?.challenge ?? req?.query?.hub?.challenge;
    if (challenge) return { ok: true, status: 200, challenge: String(challenge) };
    return { ok: true, status: 200, body: { ok: true, channel: 'instagram' } };
  }
  if (!resolveSecret(req)) {
    return { ok: false, status: 401, error: 'Instagram webhook secret geçersiz' };
  }
  const payload = body ?? {};
  const entries = Array.isArray(payload.entry) ? payload.entry : [payload];
  let ingested = 0;
  for (const entry of entries) {
    const messaging = entry.messaging ?? entry.changes ?? [];
    const rows = Array.isArray(messaging) ? messaging : [messaging];
    for (const row of rows) {
      const msg = row.message ?? row.value?.message ?? row;
      const from = String(msg.from?.id ?? msg.sender_id ?? row.sender?.id ?? 'ig-user').trim();
      const text = String(msg.text ?? msg.body ?? row.text ?? '').trim();
      if (!text) continue;
      const externalId = `ig:${from}`;
      const r = await ingestInboundChannelMessage(dataDir, tenantId, {
        channel: 'instagram',
        externalId,
        customerId: externalId,
        customerName: String(msg.from?.username ?? `IG ${from}`).trim(),
        bodyText: text,
        authorName: msg.from?.username ?? 'Instagram',
        idempotencyKey: `ig:${from}:${msg.mid ?? msg.id ?? text.slice(0, 32)}`,
      });
      if (r.ok) ingested += 1;
    }
  }
  return { ok: true, status: 200, ingested };
}
