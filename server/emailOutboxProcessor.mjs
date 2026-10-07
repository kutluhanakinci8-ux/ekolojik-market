import { sendViaEkolojikSmtp, isEkolojikSmtpConfigured } from './ekolojikSmtp.mjs';
import {
  enqueueEkolojikMail,
  processPendingOutbox,
  findOutboxByIdempotency,
} from './emailOutbox.mjs';
import { getEffectiveMailPresentation } from './postaSettings.mjs';
import { injectOpenTrackingPixel, isMailTrackEnabled } from './postaMailTrack.mjs';
import { wrapHtmlLinksForClickTracking } from './postaEngagement.mjs';

function appendSignature(text, html, signatureHtml) {
  const sig = String(signatureHtml ?? '').trim();
  if (!sig) return { text, html };
  const plainSig = sig.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const nextText = text?.trim() ? `${text}\n\n--\n${plainSig}` : plainSig;
  if (html?.trim()) {
    return { text: nextText, html: `${html}<hr/>${sig}` };
  }
  return {
    text: nextText,
    html: `<div>${String(text ?? '').replace(/\n/g, '<br/>')}</div><hr/>${sig}`,
  };
}

export function createDeliverMessage(dataDir) {
  return async function deliverMessage(message) {
    const pres = await getEffectiveMailPresentation(dataDir);
    let text = message.text;
    let html = message.html;
    if (pres.signatureHtml?.trim() && !message.signatureAppended) {
      const merged = appendSignature(text, html, pres.signatureHtml);
      text = merged.text;
      html = merged.html;
    }
    if (isMailTrackEnabled() && message.trackToken) {
      const base =
        process.env.EKOLOJIK_MAIL_TRACK_BASE_URL?.trim() ||
        process.env.EKOLOJIK_PUBLIC_URL?.trim() ||
        `http://127.0.0.1:${process.env.PORT || 5180}`;
      html = injectOpenTrackingPixel(html, message.trackToken, base);
      html = wrapHtmlLinksForClickTracking(html, message.trackToken, base);
    }
    return sendViaEkolojikSmtp({
      to: message.to,
      cc: message.cc,
      bcc: message.bcc,
      subject: message.subject,
      text,
      html: html ?? undefined,
      fromName: message.fromName || pres.fromName,
      replyTo: pres.replyTo,
      inReplyTo: message.inReplyTo,
      references: message.references,
      attachments: message.attachments,
    });
  };
}

/**
 * CRM / sistem mail — Ekolojik outbox + SMTP (Faz 1).
 * SMTP yoksa kuyruğa yazar; SMTP varsa hemen göndermeyi dener.
 */
export async function sendEkolojikMail(dataDir, payload) {
  const {
    to,
    cc,
    bcc,
    subject,
    body,
    fromName,
    idempotencyKey,
    html,
    source,
    inReplyTo,
    references,
    attachments,
  } = payload;
  if (!to?.includes('@')) {
    return { ok: false, error: 'Geçersiz e-posta adresi' };
  }

  const pres = await getEffectiveMailPresentation(dataDir);
  const effectiveFromName = fromName ?? pres.fromName;
  let textBody = body ?? '';
  let htmlBody = html;
  if (pres.signatureHtml?.trim()) {
    const merged = appendSignature(textBody, htmlBody, pres.signatureHtml);
    textBody = merged.text;
    htmlBody = merged.html;
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
    cc,
    bcc,
    subject,
    text: textBody,
    html: htmlBody,
    fromName: effectiveFromName,
    idempotencyKey: key,
    source: source ?? 'crm',
    inReplyTo,
    references,
    attachments,
    signatureAppended: Boolean(pres.signatureHtml?.trim()),
  });

  if (!isEkolojikSmtpConfigured()) {
    return {
      ok: true,
      provider: 'ekolojik-outbox-queued',
      outboxId: enqueued.message.id,
      message: 'SMTP yapılandırılmadı — outbox kuyruğunda (EKOLOJIK_SMTP_*)',
    };
  }

  const deliver = createDeliverMessage(dataDir);
  const run = await processPendingOutbox(dataDir, deliver, { limit: 5 });
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

export { processPendingOutbox, isEkolojikSmtpConfigured };
