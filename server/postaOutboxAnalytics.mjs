import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getOutboxCounts } from './emailOutbox.mjs';

function outboxRoot(dataDir) {
  return join(dataDir, 'email-outbox');
}

async function readJsonDir(dir, limit = 300) {
  try {
    const files = (await readdir(dir))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, limit);
    const rows = [];
    for (const f of files) {
      rows.push(JSON.parse(await readFile(join(dir, f), 'utf8')));
    }
    return rows;
  } catch {
    return [];
  }
}

function dayKey(iso) {
  const d = Date.parse(iso ?? '');
  if (!Number.isFinite(d)) return null;
  return new Date(d).toISOString().slice(0, 10);
}

export async function getPostaOutboxAnalytics(dataDir, { days = 14 } = {}) {
  const root = outboxRoot(dataDir);
  const sent = await readJsonDir(join(root, 'sent'), 400);
  const failed = await readJsonDir(join(root, 'failed'), 200);
  const pending = await readJsonDir(join(root, 'pending'), 100);
  const counts = await getOutboxCounts(dataDir);

  const windowDays = Math.min(Math.max(Number(days) || 14, 1), 90);
  const since = Date.now() - windowDays * 86400000;

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
    .slice(0, 8)
    .map((r) => ({
      id: r.id,
      to: r.to,
      subject: r.subject,
      at: r.sentAt || r.createdAt,
      error: r.lastError,
    }));

  return {
    ok: true,
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
    mailTrackEnabled: String(process.env.EKOLOJIK_MAIL_TRACK ?? '').trim() === '1',
  };
}
