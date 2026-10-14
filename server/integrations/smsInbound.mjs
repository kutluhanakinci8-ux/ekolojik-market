/** SMS inbound webhook — omnichannel thread (Netgsm benzeri JSON) */

import { ingestInboundChannelMessage } from '../messaging/omnichannel.mjs';
import { isCrmSmsConfigured } from '../crmSms.mjs';

function webhookSecretOk(req) {
  const expected = process.env.EKOLOJIK_SMS_INBOUND_SECRET?.trim() || '';
  if (!expected) return false;
  const header = String(req.headers['x-ekolojik-sms-secret'] ?? req.headers.authorization ?? '').trim();
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : header;
  return bearer === expected;
}

export async function handleSmsInboundWebhook(dataDir, tenantId, { method, body, req }) {
  if (method === 'GET') {
    return { ok: true, message: 'SMS inbound webhook — POST JSON { from, text }' };
  }
  if (!webhookSecretOk(req)) {
    return { ok: false, status: 401, error: 'Geçersiz SMS webhook secret' };
  }
  if (!isCrmSmsConfigured()) {
    return { ok: false, status: 503, error: 'SMS outbound yapılandırılmadı' };
  }

  const from = String(body?.from ?? body?.phone ?? body?.gsm ?? '').trim();
  const text = String(body?.text ?? body?.message ?? body?.msg ?? '').trim();
  if (!from || !text) {
    return { ok: false, status: 400, error: 'from ve text gerekli' };
  }

  const digits = from.replace(/\D/g, '');
  const externalId = `sms:${digits}`;
  const customerName = body?.name ? String(body.name).trim() : `SMS ${digits.slice(-4)}`;

  return ingestInboundChannelMessage(dataDir, tenantId, {
    channel: 'sms',
    externalId,
    customerId: `sms-${digits}`,
    customerName,
    bodyText: text,
    authorName: customerName,
    idempotencyKey: `sms:in:${digits}:${text.slice(0, 40)}`,
  });
}
