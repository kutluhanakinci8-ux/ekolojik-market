import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * E-posta: CRM_RESEND_API_KEY varsa Resend API; yoksa outbox dosyasına yaz.
 */
export async function sendCrmEmail(dataDir, { to, subject, body, fromName }) {
  const apiKey = process.env.CRM_RESEND_API_KEY?.trim();
  const from = process.env.CRM_EMAIL_FROM?.trim() || 'onboarding@resend.dev';

  if (!to?.includes('@')) {
    return { ok: false, error: 'Geçersiz e-posta adresi' };
  }

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
