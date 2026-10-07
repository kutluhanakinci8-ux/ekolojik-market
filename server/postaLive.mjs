import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const HEARTBEAT_MS = 25_000;
const RETRY_MS = 3000;
const UNREAD_POLL_MS = 15_000;

/** @type {Map<string, Set<{ res: import('http').ServerResponse }>>} */
const clientsByTenant = new Map();

let globalRevision = 0;
let lastBroadcastAt = null;

function liveDir(dataDir) {
  return join(dataDir, 'posta-live');
}

function latencyPath(dataDir) {
  return join(liveDir(dataDir), 'delivery-latency.jsonl');
}

export function getPostaLiveCapabilities() {
  return {
    ok: true,
    version: 1,
    heartbeatSec: HEARTBEAT_MS / 1000,
    unreadPollSec: UNREAD_POLL_MS / 1000,
    retryMs: RETRY_MS,
    events: ['unread', 'inbox', 'ping'],
  };
}

function clientSet(tenantId) {
  const key = tenantId || 'main';
  if (!clientsByTenant.has(key)) clientsByTenant.set(key, new Set());
  return clientsByTenant.get(key);
}

function sseWrite(res, { event, data, id }) {
  if (res.writableEnded) return false;
  try {
    if (id != null) res.write(`id: ${id}\n`);
    if (event) res.write(`event: ${event}\n`);
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    res.write(`data: ${body}\n\n`);
    return true;
  } catch {
    return false;
  }
}

export async function recordPostaDeliveryLatency(dataDir, { channel, messageAt, sourceId } = {}) {
  const atMsg = messageAt ? Date.parse(messageAt) : NaN;
  if (!Number.isFinite(atMsg)) return { skipped: true };
  const seenAt = Date.now();
  const delayMs = Math.max(0, seenAt - atMsg);
  const row = {
    channel: channel ?? 'unknown',
    sourceId: sourceId ?? null,
    messageAt: new Date(atMsg).toISOString(),
    seenAt: new Date(seenAt).toISOString(),
    delayMs,
  };
  await mkdir(liveDir(dataDir), { recursive: true });
  await appendFile(latencyPath(dataDir), `${JSON.stringify(row)}\n`, 'utf8');
  return { ok: true, delayMs };
}

async function readLatencySamples(dataDir, { days = 7 } = {}) {
  const cutoff = Date.now() - days * 86_400_000;
  try {
    const raw = await readFile(latencyPath(dataDir), 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter((r) => r && Date.parse(r.seenAt) >= cutoff);
  } catch {
    return [];
  }
}

function percentile(sorted, p) {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function channelLatencyStats(samples) {
  const byChannel = {};
  for (const s of samples) {
    const ch = s.channel || 'unknown';
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(Number(s.delayMs) || 0);
  }
  const out = {};
  for (const [ch, arr] of Object.entries(byChannel)) {
    const sorted = [...arr].sort((a, b) => a - b);
    out[ch] = {
      count: sorted.length,
      avgMs: sorted.length ? Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length) : null,
      p50Ms: percentile(sorted, 50),
      p95Ms: percentile(sorted, 95),
    };
  }
  return out;
}

export async function getPostaLiveMetrics(dataDir, { days = 7 } = {}) {
  const samples = await readLatencySamples(dataDir, { days });
  const delays = samples.map((s) => Number(s.delayMs) || 0).sort((a, b) => a - b);
  let sseClients = 0;
  for (const set of clientsByTenant.values()) sseClients += set.size;

  return {
    ok: true,
    windowDays: days,
    capabilities: getPostaLiveCapabilities(),
    sse: {
      connectedClients: sseClients,
      revision: globalRevision,
      lastBroadcastAt,
      heartbeatMs: HEARTBEAT_MS,
      unreadPollMs: UNREAD_POLL_MS,
      retryMs: RETRY_MS,
    },
    deliveryLatency: {
      sampleCount: delays.length,
      avgMs: delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : null,
      p50Ms: percentile(delays, 50),
      p95Ms: percentile(delays, 95),
      maxMs: delays.length ? delays[delays.length - 1] : null,
      byChannel: channelLatencyStats(samples),
    },
  };
}

export function attachPostaSseStream(req, res, tenantId, { fetchUnread }) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write(`retry: ${RETRY_MS}\n\n`);

  const client = { res };
  const set = clientSet(tenantId);
  set.add(client);

  const pushUnread = async () => {
    try {
      const payload = await fetchUnread();
      globalRevision += 1;
      sseWrite(res, { event: 'unread', data: payload, id: globalRevision });
    } catch (error) {
      sseWrite(res, {
        event: 'error',
        data: { ok: false, error: error instanceof Error ? error.message : 'SSE hatası' },
      });
    }
  };

  void pushUnread();
  const unreadTimer = setInterval(() => void pushUnread(), UNREAD_POLL_MS);
  const heartbeatTimer = setInterval(() => {
    if (!sseWrite(res, { event: 'ping', data: { t: Date.now(), revision: globalRevision } })) {
      cleanup();
    }
  }, HEARTBEAT_MS);

  const cleanup = () => {
    clearInterval(unreadTimer);
    clearInterval(heartbeatTimer);
    set.delete(client);
  };

  req.on('close', cleanup);
  return cleanup;
}

export async function notifyPostaLiveInbox(dataDir, tenantId, meta = {}, fetchUnread) {
  if (meta.messageAt) {
    await recordPostaDeliveryLatency(dataDir, {
      channel: meta.channel,
      messageAt: meta.messageAt,
      sourceId: meta.sourceId,
    });
  }
  globalRevision += 1;
  lastBroadcastAt = new Date().toISOString();
  const inboxPayload = { ...meta, revision: globalRevision, at: lastBroadcastAt };
  const set = clientSet(tenantId);

  for (const c of [...set]) {
    if (!sseWrite(c.res, { event: 'inbox', data: inboxPayload, id: globalRevision })) {
      set.delete(c);
    }
  }

  if (fetchUnread) {
    try {
      const unread = await fetchUnread();
      for (const c of [...set]) {
        sseWrite(c.res, { event: 'unread', data: unread, id: globalRevision });
      }
    } catch {
      /* ignore */
    }
  }
}
