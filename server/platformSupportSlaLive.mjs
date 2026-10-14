/** Destek D6 — canlı SLA dashboard verisi */

import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import { listMessagingThreads } from './messaging/store.mjs';
import { readSupportSlaPolicy } from './platformSupportPolicy.mjs';
import { readSupportFilterConfig, filterProductionMessagingThreads } from './platformSupportFilters.mjs';
import { readPlatformCases } from './platformCaseStore.mjs';
import { buildPlatformSupportOverview } from './platformSupportMetrics.mjs';

function dateKeyTr(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function allTenantIds(dataDir) {
  const ids = ['main', ...(await listTenantIds(dataDir))];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

async function buildDailyFirstResponseSeries(dataDir, days) {
  const policy = await readSupportSlaPolicy(dataDir);
  const targetMs = Math.max(1, Number(policy.firstResponseTargetMinutes) || 240) * 60_000;
  const windowDays = Math.min(30, Math.max(3, Number(days) || 7));
  const now = Date.now();
  const start = now - (windowDays - 1) * 86400000;
  const buckets = new Map();
  for (let i = 0; i < windowDays; i += 1) {
    const key = dateKeyTr(start + i * 86400000);
    buckets.set(key, { dateKey: key, met: 0, breached: 0, samples: 0 });
  }

  const smokeFilter = await readSupportFilterConfig(dataDir);
  for (const tenantId of await allTenantIds(dataDir)) {
    const listed = await listMessagingThreads(dataDir, tenantId, { limit: 250, includeArchived: false });
    const threads = filterProductionMessagingThreads(listed.threads ?? [], tenantId, smokeFilter);
    for (const t of threads) {
      if (!t.firstCustomerMessageAt || !t.firstStaffResponseAt) continue;
      const custAt = Date.parse(t.firstCustomerMessageAt);
      if (!Number.isFinite(custAt) || custAt < start) continue;
      const key = dateKeyTr(custAt);
      const row = buckets.get(key);
      if (!row) continue;
      const ms =
        t.firstResponseMs
        ?? Date.parse(t.firstStaffResponseAt) - Date.parse(t.firstCustomerMessageAt);
      if (!Number.isFinite(ms)) continue;
      row.samples += 1;
      if (ms <= targetMs) row.met += 1;
      else row.breached += 1;
    }
  }

  return [...buckets.values()];
}

export async function buildPlatformSupportSlaLive(dataDir, { days = 7 } = {}) {
  const windowDays = Math.min(30, Math.max(3, Number(days) || 7));
  const overview = await buildPlatformSupportOverview(dataDir, { days: windowDays });
  const queueBySeverity = { critical: 0, warning: 0, info: 0 };
  for (const q of overview.queue ?? []) {
    const sev = q.severity === 'critical' || q.severity === 'warning' || q.severity === 'info' ? q.severity : 'info';
    queueBySeverity[sev] += 1;
  }

  const cases = await readPlatformCases(dataDir);
  const now = Date.now();
  const overdueAll = cases
    .filter((c) => !['solved', 'closed'].includes(c.status) && c.slaDueAt && Date.parse(c.slaDueAt) < now)
    .sort((a, b) => Date.parse(a.slaDueAt) - Date.parse(b.slaDueAt));

  const caseOverdue = overdueAll.length;

  const overdueCases = overdueAll.slice(0, 15).map((c) => ({
    id: c.id,
    number: c.number,
    subject: c.subject,
    status: c.status,
    tenantId: c.tenantId,
    businessName: c.businessName,
    slaDueAt: c.slaDueAt,
    overdueMs: now - Date.parse(c.slaDueAt),
  }));

  const daily = await buildDailyFirstResponseSeries(dataDir, windowDays);
  const { buildSlaApologyQueue } = await import('./platformSupportSlaApology.mjs');
  const apologyQueue = await buildSlaApologyQueue(dataDir, { limit: 20 });

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    policy: overview.policy,
    compliancePercent: overview.totals.compliancePercent,
    totals: {
      queueSize: overview.totals.queueSize,
      pendingFirstResponse: overview.totals.pendingFirstResponse,
      slaBreaches: overview.totals.slaBreaches,
      slaMet: overview.totals.slaMet,
      openThreads: overview.totals.openThreads,
    },
    queueBySeverity,
    caseOverdue,
    overdueCases,
    daily,
    topQueue: (overview.queue ?? []).slice(0, 12),
    apologyQueue,
  };
}
