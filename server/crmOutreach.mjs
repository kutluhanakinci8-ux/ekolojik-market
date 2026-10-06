import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { isLertaPlatformConfigured, sendMailViaLertaPlatform } from './lertaPlatformBridge.mjs';

/**
 * E-posta önceliği:
 * 1) LERTA_PLATFORM_API_URL + LERTA_MAIL_API_KEY → Nakliye Borsası outbox
 * 2) CRM_RESEND_API_KEY → Resend
 * 3) data/crm-outbox/pending.jsonl
 */
export async function sendCrmEmail(dataDir, { to, subject, body, fromName, idempotencyKey }) {
  if (!to?.includes('@')) {
    return { ok: false, error: 'Geçersiz e-posta adresi' };
  }

  if (isLertaPlatformConfigured()) {
    const lerta = await sendMailViaLertaPlatform({
      to,
      subject,
      text: body,
      idempotencyKey: idempotencyKey || `ekolojik-crm:${to}:${subject}:${Date.now()}`,
    });
    if (lerta.ok) {
      return { ok: true, provider: lerta.provider, messageId: lerta.messageId };
    }
    if (!lerta.skipped) {
      return { ok: false, error: lerta.error ?? 'Lerta mail API hatası' };
    }
  }

  const apiKey = process.env.CRM_RESEND_API_KEY?.trim();
  const from = process.env.CRM_EMAIL_FROM?.trim() || 'onboarding@resend.dev';

  if (apiKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromName ? `${fromName} <${from}>` : from,
        to: [to],
        subject,
        text: body,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: text.slice(0, 200) };
    }
    return { ok: true, provider: 'resend' };
  }

  await mkdir(join(dataDir, 'crm-outbox'), { recursive: true });
  const line = JSON.stringify({
    to,
    subject,
    body,
    at: new Date().toISOString(),
  });
  await appendFile(join(dataDir, 'crm-outbox', 'pending.jsonl'), `${line}\n`, 'utf8');
  return { ok: true, provider: 'outbox', message: 'SMTP/Resend yapılandırılmadı — outbox dosyasına yazıldı' };
}
