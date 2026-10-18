import { getOutboxCounts, readOutboxStateMessages, classifyOutboxLastError } from './emailOutbox.mjs';

const ERROR_CLASS_LABELS = {
  smtp_auth: 'SMTP kimlik doğrulama',
  timeout: 'Zaman aşımı',
  network: 'Ağ / bağlantı',
  recipient: 'Alıcı / mailbox',
  mailbox_full: 'Kota / dolu',
  tls: 'TLS / sertifika',
  other: 'Diğer',
  unknown: 'Bilinmeyen',
};

function dayKey(iso) {
  const d = Date.parse(iso ?? '');
  if (!Number.isFinite(d)) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function summarizeFailureClasses(failedRows) {
  const byClass = {};
  for (const row of failedRows) {
    const key = classifyOutboxLastError(row.lastError);
    if (!byClass[key]) {
      byClass[key] = { id: key, label: ERROR_CLASS_LABELS[key] ?? key, count: 0, sample: null };
    }
    byClass[key].count += 1;
    if (!byClass[key].sample && row.lastError) {
      byClass[key].sample = String(row.lastError).slice(0, 200);
    }
  }
  return Object.values(byClass).sort((a, b) => b.count - a.count);
}

export async function getPostaOutboxAnalytics(dataDir, { days = 14, tenantId } = {}) {
  const windowDays = Math.min(Math.max(Number(days) || 14, 1), 90);
  const since = Date.now() - windowDays * 86400000;

  const [sent, failed, pending, counts] = await Promise.all([
    readOutboxStateMessages(dataDir, 'sent', { tenantId, limit: 800 }),
    readOutboxStateMessages(dataDir, 'failed', { tenantId, limit: 800 }),
    readOutboxStateMessages(dataDir, 'pending', { tenantId, limit: 200 }),
    getOutboxCounts(dataDir),
  ]);

  const inWindow = (row) => {
    const t = Date.parse(row.sentAt || row.createdAt || 0);
    return Number.isFinite(t) && t >= since;
  };

  const sentW = sent.filter(inWindow);
  const failedW = failed.filter(inWindow);
  const attempted = sentW.length + failedW.length;
  const successRate = attempted ? Math.round((sentW.length / attempted) * 1000) / 10 : null;

  const byDay = {};
  for (const row of [...sentW, ...failedW]) {
    const key = dayKey(row.sentAt || row.createdAt);
    if (!key) continue;
    if (!byDay[key]) byDay[key] = { date: key, sent: 0, failed: 0 };
    if (row.status === 'failed' || row.folder === 'failed') byDay[key].failed += 1;
    else byDay[key].sent += 1;
  }

  const recentErrors = failed
    .slice(0, 12)
    .map((r) => ({
      id: r.id,
      to: r.to,
      subject: r.subject,
      at: r.sentAt || r.createdAt,
      error: r.lastError,
      errorClass: classifyOutboxLastError(r.lastError),
    }));

  const failureBreakdown = summarizeFailureClasses(failed);

  return {
    ok: true,
    tenantId: tenantId ?? null,
    windowDays,
    counts,
    window: {
      sent: sentW.length,
      failed: failedW.length,
      attempted,
      successRatePercent: successRate,
    },
    pendingSample: pending.length,
    byDay: Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)),
    recentErrors,
    failureBreakdown,
    mailTrackEnabled: String(process.env.EKOLOJIK_MAIL_TRACK ?? '').trim() === '1',
    failedAlertThreshold: Number(process.env.EKOLOJIK_OUTBOX_FAILED_ALERT_THRESHOLD || 50),
  };
}
