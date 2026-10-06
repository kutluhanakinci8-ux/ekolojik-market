import { sendViaEkolojikSmtp, isEkolojikSmtpConfigured } from './ekolojikSmtp.mjs';
import {
  enqueueEkolojikMail,
  processPendingOutbox,
  findOutboxByIdempotency,
} from './emailOutbox.mjs';

async function deliverMessage(message) {
  return sendViaEkolojikSmtp({
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html ?? undefined,
    fromName: message.fromName ?? undefined,
  });
}

/**
 * CRM / sistem mail — Ekolojik outbox + SMTP (Faz 1).
 * SMTP yoksa kuyruğa yazar; SMTP varsa hemen göndermeyi dener.
 */
export async function sendEkolojikMail(dataDir, payload) {
  const { to, subject, body, fromName, idempotencyKey, html, source } = payload;
  if (!to?.includes('@')) {
    return { ok: false, error: 'Geçersiz e-posta adresi' };
  }

  const key = idempotencyKey || `ekolojik:${source ?? 'crm'}:${to}:${subject}`;
  const existing = await findOutboxByIdempotency(dataDir, key);
  if (existing?.status === 'sent') {
    return {
      ok: true,
      provider: 'ekolojik-outbox',
      duplicate: true,
      outboxId: existing.id,
      messageId: existing.providerMessageId,
    };
  }

  const enqueued = await enqueueEkolojikMail(dataDir, {
    to,
    subject,
    text: body,
    html,
    fromName,
    idempotencyKey: key,
    source: source ?? 'crm',
  });

  if (!isEkolojikSmtpConfigured()) {
    return {
      ok: true,
      provider: 'ekolojik-outbox-queued',
      outboxId: enqueued.message.id,
      message: 'SMTP yapılandırılmadı — outbox kuyruğunda (EKOLOJIK_SMTP_*)',
    };
  }

  const run = await processPendingOutbox(dataDir, deliverMessage, { limit: 5 });
  const after = await findOutboxByIdempotency(dataDir, key);
  if (after?.status === 'sent') {
    return {
      ok: true,
      provider: 'ekolojik-smtp',
      outboxId: after.id,
      messageId: after.providerMessageId,
      processed: run,
    };
  }
  if (after?.status === 'failed') {
    return { ok: false, error: after.lastError ?? 'Gönderim başarısız', outboxId: after.id };
  }

  return {
    ok: true,
    provider: 'ekolojik-outbox-pending',
    outboxId: enqueued.message.id,
    message: after?.lastError ? `Retry: ${after.lastError}` : 'Kuyrukta, kısa sürede tekrar denenecek',
    processed: run,
  };
}

export { processPendingOutbox, deliverMessage, isEkolojikSmtpConfigured };
