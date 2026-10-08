import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getEffectiveMailPresentation, shouldSendPostaNotification } from './postaSettings.mjs';
import { recordPostaHubAlert } from './postaHubAlerts.mjs';
import { getOutboxCounts, listFailedOutboxMessages, classifyOutboxLastError } from './emailOutbox.mjs';

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

function thresholdStatePath(dataDir) {
  return join(dataDir, 'audit', 'outbox-failed-threshold.json');
}

/** failed sayısı eşiği aşıldığında ops e-posta (günde en fazla bir kez). */
export async function maybeAlertOutboxFailedThreshold(dataDir, tenantId = 'main') {
  const threshold = Number(process.env.EKOLOJIK_OUTBOX_FAILED_ALERT_THRESHOLD || 50);
  const counts = await getOutboxCounts(dataDir);
  const failedTotal = counts.failed ?? 0;
  if (failedTotal < threshold) return { skipped: true, reason: 'below_threshold', failedTotal };

  const day = new Date().toISOString().slice(0, 10);
  const statePath = thresholdStatePath(dataDir);
  let state = { lastDay: null, lastCount: 0 };
  try {
    state = JSON.parse(await readFile(statePath, 'utf8'));
  } catch {
    /* ilk çalıştırma */
  }
  if (state.lastDay === day) return { skipped: true, reason: 'already_sent_today', failedTotal };

  const pres = await getEffectiveMailPresentation(dataDir, tenantId);
  const opsEmail = pres.opsEmail;
  if (!opsEmail?.includes('@')) return { skipped: true, reason: 'no_ops_email', failedTotal };
  if (!(await shouldSendPostaNotification(dataDir, 'outbox_failed', 'opsEmail'))) {
    return { skipped: true, reason: 'matrix_disabled', failedTotal };
  }

  const sample = await listFailedOutboxMessages(dataDir, { limit: 5 });
  const breakdown = {};
  for (const row of await listFailedOutboxMessages(dataDir, { limit: 200 })) {
    const c = classifyOutboxLastError(row.lastError);
    breakdown[c] = (breakdown[c] ?? 0) + 1;
  }

  const { sendEkolojikMail } = await import('./emailOutboxProcessor.mjs');
  const lines = [
    `Ekolojik outbox: başarısız kayıt sayısı ${failedTotal} (eşik ${threshold})`,
    '',
    'Hata sınıfları (örnek 200 kayıt):',
    ...Object.entries(breakdown).map(([k, n]) => `  ${k}: ${n}`),
    '',
    'Son örnekler:',
    ...sample.map((r) => `- ${r.id} → ${r.to}: ${(r.lastError ?? '').slice(0, 120)}`),
    '',
    'Hub: Ayarlar → E-posta → Başarısız gönderimler',
  ];

  const mail = await sendEkolojikMail(dataDir, {
    to: opsEmail,
    subject: `[Outbox uyarı] ${failedTotal} başarısız kayıt`,
    tenantId,
    body: lines.join('\n'),
    idempotencyKey: `outbox-threshold:${day}`,
    source: 'outbox-failed-threshold',
  });

  await mkdir(join(dataDir, 'audit'), { recursive: true });
  await writeFile(
    statePath,
    JSON.stringify({ lastDay: day, lastCount: failedTotal, sentAt: new Date().toISOString() }, null, 2),
    'utf8',
  );

  return { ok: true, failedTotal, threshold, mail };
}
