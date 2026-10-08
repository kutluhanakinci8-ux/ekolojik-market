import { getEffectiveMailPresentation, shouldSendPostaNotification } from './postaSettings.mjs';
import { recordPostaHubAlert } from './postaHubAlerts.mjs';

export async function maybeNotifyOutboxFailure(dataDir, message) {
  if (!message?.id) return { skipped: true };

  const summary = { ops: null, hub: null, skipped: false };

  if (await shouldSendPostaNotification(dataDir, 'outbox_failed', 'inAppHub')) {
    summary.hub = await recordPostaHubAlert(dataDir, {
      event: 'outbox_failed',
      outboxId: message.id,
      to: message.to,
      subject: message.subject,
      error: message.lastError,
      source: message.source,
    });
  }

  const tenantId = message.tenantId || 'main';
  const pres = await getEffectiveMailPresentation(dataDir, tenantId);
  const opsEmail = pres.opsEmail;
  if (
    opsEmail?.includes('@') &&
    (await shouldSendPostaNotification(dataDir, 'outbox_failed', 'opsEmail'))
  ) {
    const { sendEkolojikMail } = await import('./emailOutboxProcessor.mjs');
    summary.ops = await sendEkolojikMail(dataDir, {
      to: opsEmail,
      subject: `[Outbox hata] ${message.subject ?? message.id}`,
      tenantId,
      body: [
        'E-posta gönderimi kalıcı olarak başarısız (Ekolojik outbox)',
        '',
        `Kayıt: ${message.id}`,
        `Alıcı: ${message.to}`,
        `Konu: ${message.subject}`,
        `Kaynak: ${message.source ?? '—'}`,
        `Hata: ${message.lastError ?? '—'}`,
      ].join('\n'),
      idempotencyKey: `outbox-fail:ops:${message.id}`,
      source: 'outbox-failed-ops',
    });
  } else {
    summary.skipped = true;
  }

  return summary;
}
