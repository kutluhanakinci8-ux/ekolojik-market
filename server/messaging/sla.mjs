import { listMessagingThreads } from './store.mjs';

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

export async function getMessagingSlaMetrics(dataDir, tenantId = 'main', { days = 14 } = {}) {
  const listed = await listMessagingThreads(dataDir, tenantId, { limit: 500, includeArchived: true });
  const threads = listed.threads ?? [];
  const windowMs = Math.max(1, Number(days) || 14) * 86400_000;
  const cutoff = Date.now() - windowMs;

  const responseMs = [];
  let withCustomer = 0;
  let withStaffResponse = 0;
  let open = 0;
  let waiting = 0;
  let closed = 0;
  let pendingFirstResponse = 0;

  for (const t of threads) {
    const status = t.status ?? 'open';
    if (status === 'open') open += 1;
    else if (status === 'waiting') waiting += 1;
    else if (status === 'closed') closed += 1;

    const firstCust = t.firstCustomerMessageAt;
    if (!firstCust || Date.parse(firstCust) < cutoff) continue;
    withCustomer += 1;

    if (t.firstStaffResponseAt) {
      withStaffResponse += 1;
      const ms = t.firstResponseMs ?? msBetween(firstCust, t.firstStaffResponseAt);
      if (ms != null) responseMs.push(ms);
    } else if (status !== 'closed') {
      pendingFirstResponse += 1;
    }
  }

  responseMs.sort((a, b) => a - b);
  const sum = responseMs.reduce((a, b) => a + b, 0);
  const avgMs = responseMs.length ? Math.round(sum / responseMs.length) : null;

  return {
    ok: true,
    tenantId,
    windowDays: Math.max(1, Number(days) || 14),
    counts: {
      threadsTracked: withCustomer,
      firstResponseRecorded: withStaffResponse,
      pendingFirstResponse,
      open,
      waiting,
      closed,
    },
    firstResponse: {
      avgMs,
      medianMs: percentile(responseMs, 50),
      p90Ms: percentile(responseMs, 90),
      samples: responseMs.length,
    },
  };
}
