import { resolveWhatsAppVerifyToken, isWhatsAppChannelEnabled } from '../messaging/channelConfig.mjs';
import { ingestInboundChannelMessage } from '../messaging/omnichannel.mjs';

function graphConfig() {
  const token = process.env.EKOLOJIK_WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.EKOLOJIK_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) return null;
  return { token, phoneNumberId, version: process.env.EKOLOJIK_WHATSAPP_GRAPH_VERSION?.trim() || 'v19.0' };
}

export async function verifyWhatsAppWebhook(dataDir, tenantId, query) {
  const mode = query.get('hub.mode');
  const token = query.get('hub.verify_token');
  const challenge = query.get('hub.challenge');
  const expected = await resolveWhatsAppVerifyToken(dataDir, tenantId);
  if (mode === 'subscribe' && token && expected && token === expected && challenge) {
    return { ok: true, challenge };
  }
  return { ok: false, status: 403, error: 'Verify token uyuşmuyor' };
}

function extractInboundMessages(body) {
  const out = [];
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const contactName = value.contacts?.[0]?.profile?.name ?? null;
      for (const msg of value.messages ?? []) {
        if (msg.type === 'text' && msg.text?.body) {
          out.push({
            from: String(msg.from ?? ''),
            messageId: String(msg.id ?? ''),
            text: String(msg.text.body),
            timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
            contactName,
          });
        }
      }
    }
  }
  return out;
}

export async function handleWhatsAppWebhook(dataDir, tenantId, { method, query, body }) {
  if (method === 'GET') {
    return verifyWhatsAppWebhook(dataDir, tenantId, query);
  }
  if (!(await isWhatsAppChannelEnabled(dataDir, tenantId))) {
    return { ok: false, status: 503, error: 'WhatsApp kanalı kapalı veya yapılandırılmamış' };
  }
  const inbound = extractInboundMessages(body);
  const results = [];
  for (const row of inbound) {
    if (!row.from) continue;
    const r = await ingestInboundChannelMessage(dataDir, tenantId, {
      channel: 'whatsapp',
      externalId: `wa:${row.from}`,
      customerId: `wa-${row.from}`,
      customerName: row.contactName || `WhatsApp ${row.from}`,
      bodyText: row.text,
      authorName: row.contactName || 'WhatsApp',
      idempotencyKey: `wa:${row.messageId}`,
    });
    results.push({ ...r, channel: 'whatsapp' });
  }
  return { ok: true, processed: results.length, results };
}

export async function sendWhatsAppText(toWaId, text) {
  const cfg = graphConfig();
  if (!cfg) return { ok: false, error: 'WhatsApp env eksik (EKOLOJIK_WHATSAPP_*)' };
  const to = String(toWaId).replace(/\D/g, '');
  const url = `https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: String(text ?? '').slice(0, 4096) },
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json?.error?.message || `Graph HTTP ${res.status}` };
  }
  return { ok: true, messageId: json.messages?.[0]?.id ?? null };
}
