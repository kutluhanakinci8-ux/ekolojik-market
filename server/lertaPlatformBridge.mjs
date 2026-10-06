/**
 * Nakliye Borsası (Lerta) public API köprüsü — mail + mesaj.
 * API anahtarı yalnızca sunucuda; tarayıcıya verilmez.
 *
 * Env:
 *   LERTA_PLATFORM_API_URL  örn. https://app.lerta.com.tr/api/v1
 *   LERTA_MAIL_API_KEY      mail + messaging için org API key
 */

function baseUrl() {
  const raw = process.env.LERTA_PLATFORM_API_URL?.trim() || '';
  return raw.replace(/\/$/, '');
}

function apiKey() {
  return process.env.LERTA_MAIL_API_KEY?.trim() || '';
}

export function isLertaPlatformConfigured() {
  if (process.env.LERTA_PLATFORM_BRIDGE === '0' || process.env.LERTA_PLATFORM_BRIDGE === 'false') {
    return false;
  }
  return Boolean(baseUrl() && apiKey());
}

function authHeaders() {
  const key = apiKey();
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

/** CRM / transactional mail → NB outbox */
export async function sendMailViaLertaPlatform({
  to,
  subject,
  text,
  html,
  idempotencyKey,
}) {
  if (!isLertaPlatformConfigured()) {
    return { ok: false, skipped: true, error: 'LERTA_PLATFORM_API_URL veya LERTA_MAIL_API_KEY yok' };
  }
  if (!to?.includes('@')) {
    return { ok: false, error: 'Geçersiz e-posta' };
  }

  const url = `${baseUrl()}/public/lerta-mail/v1/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      to,
      subject,
      text: text ?? subject,
      html,
      idempotencyKey,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: data.message || data.error || res.statusText || String(res.status),
    };
  }
  return {
    ok: true,
    provider: 'lerta-mail-api',
    messageId: data.messageId,
    status: data.status,
  };
}

/** Mesaj thread listesi (firma) */
export async function listMessagingThreads({ limit = 50 } = {}) {
  if (!isLertaPlatformConfigured()) {
    return { ok: false, error: 'Lerta platform yapılandırılmadı' };
  }
  const url = `${baseUrl()}/public/lerta-messaging/v1/threads?limit=${limit}`;
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.message || String(res.status) };
  }
  return { ok: true, data };
}

/** Thread mesaj gönder */
export async function sendMessagingMessage({ threadId, bodyText, locale = 'tr' }) {
  if (!isLertaPlatformConfigured()) {
    return { ok: false, error: 'Lerta platform yapılandırılmadı' };
  }
  const url = `${baseUrl()}/public/lerta-messaging/v1/threads/${encodeURIComponent(threadId)}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ bodyText, locale }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: data.message || String(res.status) };
  }
  return { ok: true, data };
}
