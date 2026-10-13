/** Platform — müşteri mesajlaşma SLA, kuyruk ve kiracı hazırlığı */

import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import { listMessagingThreads } from './messaging/store.mjs';
import { ensurePostaOnboarding } from './postaOnboarding.mjs';
import { isMessagingPublicApiConfigured } from './messaging/publicConfig.mjs';
import { readSupportSlaPolicy, DEFAULT_SUPPORT_SLA_POLICY } from './platformSupportPolicy.mjs';
import { readSupportFilterConfig, filterProductionMessagingThreads } from './platformSupportFilters.mjs';
import { listPlatformSupportInbox } from './platformSupportInbox.mjs';
import { computeMessagingSlaFromThreads } from './messaging/sla.mjs';

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

function msBetween(a, b) {
  const t0 = Date.parse(a);
  const t1 = Date.parse(b);
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) return null;
  return t1 - t0;
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function queueSeverity({ kind, waitMs, targetMs, staleMs }) {
  if (kind === 'first_response') {
    if (waitMs >= targetMs * 2) return 'critical';
    if (waitMs >= targetMs) return 'warning';
    return 'info';
  }
  if (waitMs >= staleMs * 2) return 'critical';
  if (waitMs >= staleMs) return 'warning';
  return 'info';
}

export async function buildPlatformSupportOverview(dataDir, { days } = {}) {
  const policy = await readSupportSlaPolicy(dataDir);
  const windowDays = Math.min(
    90,
    Math.max(7, Number(days) || policy.windowDaysDefault || DEFAULT_SUPPORT_SLA_POLICY.windowDaysDefault),
  );
  const targetMs = Math.max(1, Number(policy.firstResponseTargetMinutes) || 240) * 60_000;
  const staleMs = Math.max(1, Number(policy.staleWaitingHours) || 24) * 3600_000;
  const now = Date.now();

  const queue = [];
  const tenantRows = [];
  const allResponseMs = [];
  let breachesFirstResponse = 0;
  let metFirstResponse = 0;
  let openTotal = 0;
  let waitingTotal = 0;
  let pendingFirstResponseTotal = 0;

  const messagingPublicConfigured = isMessagingPublicApiConfigured();
  const smokeFilter = await readSupportFilterConfig(dataDir);

  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    const businessName = businessNameFor(store, tenantId);
    const onboarding = store
      ? ensurePostaOnboarding(store.settings, store.settings?.tenantMeta?.email)
      : null;

    const listed = await listMessagingThreads(dataDir, tenantId, { limit: 200, includeArchived: false });
    const threads = filterProductionMessagingThreads(listed.threads ?? [], tenantId, smokeFilter);
    const sla = computeMessagingSlaFromThreads(threads, { days: windowDays, tenantId });

    let tenantBreaches = 0;
    let tenantQueue = 0;

    for (const t of threads) {
      const status = t.status ?? 'open';
      if (status === 'open') openTotal += 1;
      if (status === 'waiting') waitingTotal += 1;

      const updatedMs = Date.parse(t.updatedAt ?? t.createdAt ?? '');
      const idleMs = Number.isFinite(updatedMs) ? now - updatedMs : 0;

      if (!t.firstStaffResponseAt && t.firstCustomerMessageAt && status !== 'closed') {
        pendingFirstResponseTotal += 1;
        const waitMs = msBetween(t.firstCustomerMessageAt, new Date(now).toISOString()) ?? idleMs;
        const sev = queueSeverity({ kind: 'first_response', waitMs, targetMs, staleMs });
        if (waitMs >= targetMs) tenantBreaches += 1;
        tenantQueue += 1;
        queue.push({
          id: `${tenantId}:${t.id}`,
          tenantId,
          businessName,
          threadId: t.id,
          kind: 'first_response',
          severity: sev,
          status,
          subject: t.subject ?? '—',
          customerName: t.customerName ?? '—',
          waitMs,
          targetMs,
          updatedAt: t.updatedAt ?? t.createdAt,
          assignedUserId: t.assignedUserId ?? null,
          channel: t.channel ?? 'web',
        });
      } else if (status === 'waiting' && idleMs >= staleMs) {
        const sev = queueSeverity({ kind: 'stale_waiting', waitMs: idleMs, targetMs, staleMs });
        tenantQueue += 1;
        queue.push({
          id: `${tenantId}:${t.id}:wait`,
          tenantId,
          businessName,
          threadId: t.id,
          kind: 'stale_waiting',
          severity: sev,
          status,
          subject: t.subject ?? '—',
          customerName: t.customerName ?? '—',
          waitMs: idleMs,
          targetMs: staleMs,
          updatedAt: t.updatedAt ?? t.createdAt,
          assignedUserId: t.assignedUserId ?? null,
          channel: t.channel ?? 'web',
        });
      }

      if (t.firstStaffResponseAt && t.firstCustomerMessageAt) {
        const ms = t.firstResponseMs ?? msBetween(t.firstCustomerMessageAt, t.firstStaffResponseAt);
        const custAt = Date.parse(t.firstCustomerMessageAt);
        if (ms != null && Number.isFinite(custAt) && custAt >= now - windowDays * 86400000) {
          allResponseMs.push(ms);
          if (ms <= targetMs) metFirstResponse += 1;
          else breachesFirstResponse += 1;
        }
      }
    }

    const steps = onboarding?.steps ?? {};
    const onboardingDone = steps.messagingEmbed?.done || steps.messagingEmbed?.skipped;

    tenantRows.push({
      tenantId,
      businessName,
      messaging: sla.counts,
      firstResponse: sla.firstResponse,
      onboardingStatus: onboarding?.status ?? 'unknown',
      messagingEmbedReady: Boolean(onboardingDone),
      postaOnboardingComplete: onboarding?.status === 'completed',
      queueItems: tenantQueue,
      slaBreaches: tenantBreaches,
    });
  }

  allResponseMs.sort((a, b) => a - b);
  const sum = allResponseMs.reduce((a, b) => a + b, 0);
  const complianceDenom = metFirstResponse + breachesFirstResponse;
  const compliancePercent =
    complianceDenom > 0 ? Math.round((metFirstResponse / complianceDenom) * 1000) / 10 : null;

  const order = { critical: 0, warning: 1, info: 2 };
  queue.sort((a, b) => {
    const s = (order[a.severity] ?? 9) - (order[b.severity] ?? 9);
    if (s !== 0) return s;
    return b.waitMs - a.waitMs;
  });

  tenantRows.sort((a, b) => b.queueItems - a.queueItems || b.slaBreaches - a.slaBreaches);

  const inbox = await listPlatformSupportInbox(dataDir, { limit: 8 });

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    policy: {
      firstResponseTargetMinutes: policy.firstResponseTargetMinutes,
      staleWaitingHours: policy.staleWaitingHours,
    },
    capabilities: {
      messagingPublicConfigured,
      supportMailboxConfigured: inbox.mailbox?.configured === true,
      supportMailboxAddress: inbox.mailbox?.address ?? null,
    },
    inbox: {
      unread: inbox.unread,
      total: inbox.total,
      lastSyncAt: inbox.lastSyncAt,
      recent: (inbox.messages ?? []).map((m) => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        receivedAt: m.receivedAt,
        readAt: m.readAt,
        autoreplySentAt: m.autoreplySentAt,
      })),
    },
    totals: {
      openThreads: openTotal,
      waitingThreads: waitingTotal,
      pendingFirstResponse: pendingFirstResponseTotal,
      queueSize: queue.length,
      slaBreaches: breachesFirstResponse,
      slaMet: metFirstResponse,
      compliancePercent,
      firstResponse: {
        avgMs: allResponseMs.length ? Math.round(sum / allResponseMs.length) : null,
        medianMs: percentile(allResponseMs, 50),
        p90Ms: percentile(allResponseMs, 90),
        samples: allResponseMs.length,
      },
    },
    queue: queue.slice(0, 80),
    tenants: tenantRows,
  };
}

export function buildPlatformSupportCsv(overview) {
  const lines = [
    'tenantId,businessName,open,waiting,pendingFirstResponse,medianFirstResponseMs,queueItems,slaBreaches,onboardingStatus',
  ];
  for (const t of overview.tenants ?? []) {
    lines.push(
      [
        t.tenantId,
        t.businessName,
        t.messaging?.open ?? 0,
        t.messaging?.waiting ?? 0,
        t.messaging?.pendingFirstResponse ?? 0,
        t.firstResponse?.medianMs ?? '',
        t.queueItems,
        t.slaBreaches,
        t.onboardingStatus,
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
