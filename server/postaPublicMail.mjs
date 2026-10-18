import { createDeliverMessage } from './emailOutboxProcessor.mjs';

function resolvePublicMailKey() {
  return process.env.EKOLOJIK_PUBLIC_MAIL_API_KEY?.trim() || '';
}

export function getPostaPublicMailCapabilities() {
  return {
    ok: true,
    version: 1,
    apiPrefix: '/api/public/mail/v1',
    configured: Boolean(resolvePublicMailKey()),
    scopes: ['messages:send'],
  };
}

export function assertPostaPublicMailAuth(req) {
  const expected = resolvePublicMailKey();
  if (!expected) {
    return { ok: false, status: 503, error: 'Public mail API kapalı (EKOLOJIK_PUBLIC_MAIL_API_KEY)' };
  }
  const header =
    req.headers['x-ekolojik-mail-api-key'] ||
    req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
  if (!header || header !== expected) {
    return { ok: false, status: 401, error: 'Geçersiz mail API anahtarı' };
  }
  return { ok: true };
}

export async function sendPostaPublicMail(dataDir, payload) {
  const to = String(payload.to ?? '').trim();
  const subject = String(payload.subject ?? '').trim() || '(konu yok)';
  const text = String(payload.text ?? payload.body ?? '').trim();
  if (!to.includes('@') || !text) {
    return { ok: false, error: 'to ve text zorunlu' };
  }
  const result = await createDeliverMessage(dataDir, {
    to,
    subject,
    body: text,
    html: payload.html,
    idempotencyKey: payload.idempotencyKey ?? `public:${Date.now()}`,
    source: 'public-mail-api',
  });
  return result;
}
