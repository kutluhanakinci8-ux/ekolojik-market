/** Platform — posta outbox, mesajlaşma SLA ve engagement özetleri */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import { isMailTrackEnabled } from './postaMailTrack.mjs';
import { isClickTrackEnabled, engagementWebhookConfigured } from './postaEngagement.mjs';

async function allTenantIds(dataDir) {
  const ids = ['main', ...(await listTenantIds(dataDir))];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function businessNameFor(store, tenantId) {
  return (
    String(store?.settings?.businessName ?? '').trim()
    || (tenantId === 'main' ? 'Greenleaf Market' : tenantId)
  );
}

async function readJsonlLines(filePath, maxLines = 15000) {
  try {
    const raw = await readFile(filePath, 'utf8');
    const lines = raw.split('\n').filter(Boolean);
    const slice = lines.length > maxLines ? lines.slice(-maxLines) : lines;
    const rows = [];
    for (const line of slice) {
      try {
        rows.push(JSON.parse(line));
      } catch {
        /* skip */
      }
    }
    return rows;
  } catch {
    return [];
  }
}

function inWindow(row, sinceMs) {
  const t = Date.parse(row?.at ?? '');
  return Number.isFinite(t) && t >= sinceMs;
}

export async function summarizePlatformEngagement(dataDir, days = 14) {
  const windowDays = Math.min(Math.max(Number(days) || 14, 1), 90);
  const since = Date.now() - windowDays * 86400000;
  const base = join(dataDir, 'posta-track');
  const opens = (await readJsonlLines(join(base, 'opens.jsonl'))).filter((r) => inWindow(r, since));
  const clicks = (await readJsonlLines(join(base, 'clicks.jsonl'))).filter((r) => inWindow(r, since));
  const bounces = (await readJsonlLines(join(base, 'bounces.jsonl'))).filter((r) => inWindow(r, since));

  const byTenant = new Map();
  const bump = (tid, field) => {
    const key = String(tid || 'main');
    if (!byTenant.has(key)) {
      byTenant.set(key, { tenantId: key, opens: 0, clicks: 0, bounces: 0 });
    }
    byTenant.get(key)[field] += 1;
  };
  for (const r of opens) bump(r.tenantId, 'opens');
  for (const r of clicks) bump(r.tenantId, 'clicks');
  for (const r of bounces) bump(r.tenantId, 'bounces');

  return {
    windowDays,
    mailTrackEnabled: isMailTrackEnabled(),
    clickTrackEnabled: isClickTrackEnabled(),
    webhookConfigured: engagementWebhookConfigured(),
    totals: {
      opens: opens.length,
      uniqueOpens: new Set(opens.map((r) => r.token).filter(Boolean)).size,
      clicks: clicks.length,
      uniqueClicks: new Set(clicks.map((r) => r.token).filter(Boolean)).size,
      bounces: bounces.length,
    },
    byTenant: [...byTenant.values()].sort(
      (a, b) => b.opens + b.clicks + b.bounces - (a.opens + a.clicks + a.bounces),
    ),
  };
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildPlatformCommsCsv({ tenants, windowDays, generatedAt }) {
  const lines = [
    'tenantId,businessName,pending,sent,failed,messagingOpen,messagingWaiting,messagingClosed,pendingFirstResponse,firstResponseMedianMs,engagementOpens,engagementClicks,engagementBounces',
  ];
  for (const row of tenants ?? []) {
    lines.push(
      [
        row.tenantId,
        row.businessName,
        row.outbox?.pending ?? 0,
        row.outbox?.sent ?? 0,
        row.outbox?.failed ?? 0,
        row.messaging?.open ?? 0,
        row.messaging?.waiting ?? 0,
        row.messaging?.closed ?? 0,
        row.messaging?.pendingFirstResponse ?? 0,
        row.firstResponse?.medianMs ?? '',
        row.engagement?.opens ?? 0,
        row.engagement?.clicks ?? 0,
        row.engagement?.bounces ?? 0,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  const meta = `# generatedAt=${generatedAt}; windowDays=${windowDays}`;
  return `${meta}\n${lines.join('\n')}\n`;
}

export async function buildPlatformCommsOverview(dataDir, { days = 14 } = {}) {
  const windowDays = Math.min(Math.max(Number(days) || 14, 1), 90);
  const { getPostaOutboxAnalytics } = await import('./postaOutboxAnalytics.mjs');
  const { getOutboxCounts, getOutboxCountsByTenant, listMergedRecentOutbox } = await import('./emailOutbox.mjs');
  const { getMessagingSlaMetrics } = await import('./messaging/sla.mjs');
  const { isEkolojikSmtpConfigured } = await import('./emailOutboxProcessor.mjs');

  const [counts, analytics, recentOutbox, countsByTenant, engagement] = await Promise.all([
    getOutboxCounts(dataDir),
    getPostaOutboxAnalytics(dataDir, { days: windowDays }),
    listMergedRecentOutbox(dataDir, 36),
    getOutboxCountsByTenant(dataDir),
    summarizePlatformEngagement(dataDir, windowDays),
  ]);

  const engagementByTenant = new Map(engagement.byTenant.map((r) => [r.tenantId, r]));
  const outboxByTenant = new Map(countsByTenant.map((r) => [r.tenantId, r]));

  const tenantRows = [];
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    const businessName = businessNameFor(store, tenantId);
    const outbox = outboxByTenant.get(tenantId) ?? { tenantId, pending: 0, sent: 0, failed: 0 };
    const sla = await getMessagingSlaMetrics(dataDir, tenantId, { days: windowDays });
    const eng = engagementByTenant.get(tenantId) ?? { opens: 0, clicks: 0, bounces: 0 };
    tenantRows.push({
      tenantId,
      businessName,
      outbox: { pending: outbox.pending, sent: outbox.sent, failed: outbox.failed },
      messaging: sla.counts,
      firstResponse: sla.firstResponse,
      engagement: { opens: eng.opens, clicks: eng.clicks, bounces: eng.bounces },
    });
  }

  tenantRows.sort((a, b) => {
    const scoreA = a.outbox.failed * 10 + a.outbox.pending + (a.messaging?.pendingFirstResponse ?? 0);
    const scoreB = b.outbox.failed * 10 + b.outbox.pending + (b.messaging?.pendingFirstResponse ?? 0);
    return scoreB - scoreA;
  });

  const messagingTotals = tenantRows.reduce(
    (acc, t) => ({
      open: acc.open + (t.messaging?.open ?? 0),
      waiting: acc.waiting + (t.messaging?.waiting ?? 0),
      closed: acc.closed + (t.messaging?.closed ?? 0),
      pendingFirstResponse: acc.pendingFirstResponse + (t.messaging?.pendingFirstResponse ?? 0),
    }),
    { open: 0, waiting: 0, closed: 0, pendingFirstResponse: 0 },
  );

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    outboxCounts: counts,
    outboxWindow: analytics.window,
    outboxByDay: analytics.byDay,
    failureBreakdown: analytics.failureBreakdown,
    recentErrors: analytics.recentErrors,
    pendingSample: analytics.pendingSample,
    recentOutbox: recentOutbox.map((r) => ({
      id: r.id,
      tenantId: r.tenantId ?? 'main',
      folder: r.folder ?? r.status,
      to: r.to,
      subject: r.subject,
      at: r.sentAt || r.createdAt,
      lastError: r.lastError ?? null,
    })),
    engagement,
    messagingTotals,
    tenants: tenantRows,
    capabilities: {
      smtpConfigured: isEkolojikSmtpConfigured(),
      mailTrackEnabled: analytics.mailTrackEnabled,
      failedAlertThreshold: analytics.failedAlertThreshold,
    },
  };
}
