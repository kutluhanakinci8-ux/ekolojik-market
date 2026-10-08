import { mkdir, readFile, readdir, rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createMailTrackToken, isMailTrackEnabled } from './postaMailTrack.mjs';

const MAX_ATTEMPTS = 3;
const RETRY_SECONDS = [60, 120, 300];

function outboxRoot(dataDir) {
  return join(dataDir, 'email-outbox');
}

function safeTenantId(tenantId) {
  const raw = String(tenantId || 'main').trim() || 'main';
  return raw.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/** Idempotency anahtarını kiracıya göre ayır (Faz 44). */
export function idempotencyKeyForTenant(tenantId, rawKey) {
  const tid = safeTenantId(tenantId);
  const k = String(rawKey ?? '').trim();
  if (!k) return `${tid}::`;
  const prefix = `${tid}::`;
  if (k.startsWith(prefix)) return k;
  return `${prefix}${k}`;
}

function dirPending(root) {
  return join(root, 'pending');
}
function dirSent(root) {
  return join(root, 'sent');
}
function dirFailed(root) {
  return join(root, 'failed');
}

function dirPendingTenant(root, tenantId) {
  return join(dirPending(root), safeTenantId(tenantId));
}
function dirSentTenant(root, tenantId) {
  return join(dirSent(root), safeTenantId(tenantId));
}
function dirFailedTenant(root, tenantId) {
  return join(dirFailed(root), safeTenantId(tenantId));
}

let legacyOutboxMigrated = false;

/** Eski düz pending/sent/failed/*.json → alt klasör {tenantId}/ */
async function migrateLegacyFlatOutbox(root) {
  if (legacyOutboxMigrated) return;
  legacyOutboxMigrated = true;
  for (const sub of ['pending', 'sent', 'failed']) {
    const base = join(root, sub);
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.endsWith('.json')) continue;
      const full = join(base, ent.name);
      let raw;
      try {
        raw = await readFile(full, 'utf8');
      } catch {
        continue;
      }
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        continue;
      }
      const tid = safeTenantId(msg.tenantId);
      const destDir = join(base, tid);
      await mkdir(destDir, { recursive: true });
      await writeFile(join(destDir, ent.name), raw, 'utf8');
      await unlink(full);
    }
  }
}

async function ensureDirs(dataDir, tenantId = 'main') {
  const root = outboxRoot(dataDir);
  await mkdir(dirPendingTenant(root, tenantId), { recursive: true });
  await mkdir(dirSentTenant(root, tenantId), { recursive: true });
  await mkdir(dirFailedTenant(root, tenantId), { recursive: true });
  await migrateLegacyFlatOutbox(root);
  return root;
}

function hashIdempotency(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 24);
}

async function collectJsonFilesInState(root, state) {
  const base = join(root, state);
  const hits = [];
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return hits;
  }
  for (const ent of entries) {
    if (ent.isFile() && ent.name.endsWith('.json')) {
      hits.push({ file: ent.name, dir: base, tenantId: 'main' });
      continue;
    }
    if (!ent.isDirectory()) continue;
    const tenantDir = join(base, ent.name);
    let files;
    try {
      files = await readdir(tenantDir);
    } catch {
      continue;
    }
    for (const f of files) {
      if (f.endsWith('.json')) {
        hits.push({ file: f, dir: tenantDir, tenantId: ent.name });
      }
    }
  }
  return hits;
}

export async function findOutboxByIdempotency(dataDir, idempotencyKey) {
  if (!idempotencyKey?.trim()) return null;
  const root = outboxRoot(dataDir);
  await migrateLegacyFlatOutbox(root);
  const tag = hashIdempotency(idempotencyKey.trim());
  for (const sub of ['pending', 'sent', 'failed']) {
    const locations = await collectJsonFilesInState(root, sub);
    const hit = locations.find((loc) => loc.file.includes(tag));
    if (hit) {
      const raw = await readFile(join(hit.dir, hit.file), 'utf8');
      return JSON.parse(raw);
    }
  }
  return null;
}

export async function enqueueEkolojikMail(
  dataDir,
  {
    to,
    cc,
    bcc,
    subject,
    text,
    html,
    fromName,
    idempotencyKey,
    source = 'crm',
    inReplyTo,
    references,
    attachments,
    signatureAppended,
    tenantId = 'main',
  },
) {
  await ensureDirs(dataDir, tenantId);
  const key = idempotencyKeyForTenant(
    tenantId,
    idempotencyKey?.trim() || `ekolojik:${source}:${to}:${subject}:${Date.now()}`,
  );
  const existing = await findOutboxByIdempotency(dataDir, key);
  if (existing) {
    return { ok: true, duplicate: true, message: existing };
  }

  const id = randomUUID();
  const tag = hashIdempotency(key);
  const message = {
    id,
    idempotencyKey: key,
    to,
    cc: cc?.trim() || null,
    bcc: bcc?.trim() || null,
    subject,
    text: text ?? '',
    html: html ?? null,
    fromName: fromName ?? null,
    source,
    inReplyTo: inReplyTo ?? null,
    references: references ?? null,
    attachments: Array.isArray(attachments) ? attachments : [],
    signatureAppended: Boolean(signatureAppended),
    trackToken: isMailTrackEnabled() ? createMailTrackToken(id) : null,
    status: 'pending',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    createdAt: new Date().toISOString(),
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
    sentAt: null,
    providerMessageId: null,
    tenantId: safeTenantId(tenantId),
  };

  const filename = `${message.createdAt.replace(/[:.]/g, '-')}_${tag}_${id}.json`;
  const root = outboxRoot(dataDir);
  const path = join(dirPendingTenant(root, message.tenantId), filename);
  await writeFile(path, JSON.stringify(message, null, 2), 'utf8');
  return { ok: true, duplicate: false, message, file: filename };
}

async function listDirJson(dir, limit) {
  try {
    const files = (await readdir(dir))
      .filter((f) => f.endsWith('.json'))
      .sort()
      .reverse();
    const slice = files.slice(0, limit);
    const rows = [];
    for (const f of slice) {
      const raw = await readFile(join(dir, f), 'utf8');
      rows.push(JSON.parse(raw));
    }
    return rows;
  } catch {
    return [];
  }
}

async function listStateJsonAllTenants(root, state, limit) {
  const base = join(root, state);
  await migrateLegacyFlatOutbox(root);
  const perTenant = Math.max(limit, 10);
  const rows = [];
  let entries;
  try {
    entries = await readdir(base, { withFileTypes: true });
  } catch {
    return rows;
  }
  for (const ent of entries) {
    if (ent.isFile() && ent.name.endsWith('.json')) {
      const raw = await readFile(join(base, ent.name), 'utf8');
      rows.push(JSON.parse(raw));
      continue;
    }
    if (!ent.isDirectory()) continue;
    rows.push(...(await listDirJson(join(base, ent.name), perTenant)));
  }
  return rows.slice(0, limit);
}

export async function listRecentOutbox(dataDir, limit = 50) {
  const root = outboxRoot(dataDir);
  const pending = await listStateJsonAllTenants(root, 'pending', limit);
  const sent = await listStateJsonAllTenants(root, 'sent', limit);
  const failed = await listStateJsonAllTenants(root, 'failed', limit);
  return { pending, sent, failed };
}

export async function listMergedRecentOutbox(dataDir, limit = 50) {
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const { pending, sent, failed } = await listRecentOutbox(dataDir, max);
  const rows = [
    ...pending.map((m) => ({ ...m, folder: 'pending' })),
    ...sent.map((m) => ({ ...m, folder: 'sent' })),
    ...failed.map((m) => ({ ...m, folder: 'failed' })),
  ];
  rows.sort((a, b) => {
    const ta = Date.parse(a.sentAt || a.createdAt || 0);
    const tb = Date.parse(b.sentAt || b.createdAt || 0);
    return tb - ta;
  });
  return rows.slice(0, max);
}

export async function getOutboxCounts(dataDir) {
  const root = outboxRoot(dataDir);
  await migrateLegacyFlatOutbox(root);
  async function countState(state) {
    const locations = await collectJsonFilesInState(root, state);
    return locations.length;
  }
  return {
    pending: await countState('pending'),
    sent: await countState('sent'),
    failed: await countState('failed'),
  };
}

function isReady(message) {
  if (message.status !== 'pending') return false;
  const next = Date.parse(message.nextAttemptAt || message.createdAt);
  return Number.isFinite(next) && next <= Date.now();
}

/** Kiracılar arasında adil sıra: her turda her tenant’tan en fazla bir iş. */
function interleavePendingLocations(locations) {
  const buckets = new Map();
  for (const loc of locations) {
    const tid = loc.tenantId || 'main';
    if (!buckets.has(tid)) buckets.set(tid, []);
    buckets.get(tid).push(loc);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => a.file.localeCompare(b.file));
  }
  const tenantIds = [...buckets.keys()].sort();
  const order = [];
  let round = true;
  while (round) {
    round = false;
    for (const tid of tenantIds) {
      const queue = buckets.get(tid);
      if (queue?.length) {
        order.push(queue.shift());
        round = true;
      }
    }
  }
  return order;
}

export async function processPendingOutbox(dataDir, sendFn, { limit = 20 } = {}) {
  const root = await ensureDirs(dataDir);
  const locations = interleavePendingLocations(await collectJsonFilesInState(root, 'pending'));
  const results = { processed: 0, sent: 0, failed: 0, deferred: 0 };

  for (const loc of locations) {
    if (results.processed >= limit) break;
    const full = join(loc.dir, loc.file);
    const message = JSON.parse(await readFile(full, 'utf8'));
    if (!isReady(message)) {
      results.deferred += 1;
      continue;
    }

    results.processed += 1;
    const tid = safeTenantId(message.tenantId);
    try {
      const sent = await sendFn(message);
      message.status = 'sent';
      message.sentAt = new Date().toISOString();
      message.providerMessageId = sent.messageId ?? null;
      message.lastError = null;
      const dest = join(dirSentTenant(root, tid), loc.file);
      await writeFile(dest, JSON.stringify(message, null, 2), 'utf8');
      await unlink(full);
      results.sent += 1;
    } catch (error) {
      message.attempts = (message.attempts ?? 0) + 1;
      message.lastError = error instanceof Error ? error.message : String(error);
      if (message.attempts >= message.maxAttempts) {
        message.status = 'failed';
        const dest = join(dirFailedTenant(root, tid), loc.file);
        await writeFile(dest, JSON.stringify(message, null, 2), 'utf8');
        await unlink(full);
        results.failed += 1;
        try {
          const { maybeNotifyOutboxFailure } = await import('./postaOutboxNotify.mjs');
          await maybeNotifyOutboxFailure(dataDir, message);
        } catch {
          /* bildirim opsiyonel */
        }
        try {
          const { recordEngagementBounce } = await import('./postaEngagement.mjs');
          await recordEngagementBounce(dataDir, {
            outboxId: message.id,
            to: message.to,
            subject: message.subject,
            error: message.lastError,
            source: message.source,
          });
        } catch {
          /* engagement opsiyonel */
        }
      } else {
        const delaySec = RETRY_SECONDS[Math.min(message.attempts - 1, RETRY_SECONDS.length - 1)];
        message.nextAttemptAt = new Date(Date.now() + delaySec * 1000).toISOString();
        await writeFile(full, JSON.stringify(message, null, 2), 'utf8');
        results.deferred += 1;
      }
    }
  }

  return results;
}

export async function findOutboxMessageById(dataDir, id) {
  if (!id?.trim()) return null;
  const root = outboxRoot(dataDir);
  await migrateLegacyFlatOutbox(root);
  for (const sub of ['pending', 'sent', 'failed']) {
    const locations = await collectJsonFilesInState(root, sub);
    for (const loc of locations) {
      const raw = await readFile(join(loc.dir, loc.file), 'utf8');
      const msg = JSON.parse(raw);
      if (msg.id === id) {
        return { message: msg, folder: sub, file: loc.file, tenantId: loc.tenantId, dir: loc.dir };
      }
    }
  }
  return null;
}

/** failed → pending (hub “tekrar dene”) */
export async function requeueFailedOutboxMessage(dataDir, id) {
  const hit = await findOutboxMessageById(dataDir, id);
  if (!hit) return { ok: false, error: 'Outbox kaydı bulunamadı' };
  if (hit.folder !== 'failed') {
    return { ok: false, error: 'Yalnızca başarısız kayıtlar yeniden kuyruğa alınır' };
  }
  const root = outboxRoot(dataDir);
  const message = hit.message;
  const tid = safeTenantId(message.tenantId);
  message.status = 'pending';
  message.attempts = 0;
  message.lastError = null;
  message.nextAttemptAt = new Date().toISOString();
  const dest = join(dirPendingTenant(root, tid), hit.file);
  await writeFile(dest, JSON.stringify(message, null, 2), 'utf8');
  await unlink(join(hit.dir, hit.file));
  return { ok: true, message };
}

export function classifyOutboxLastError(error) {
  const s = String(error ?? '').toLowerCase();
  if (!s.trim()) return 'unknown';
  if (/535|534|authentication|auth failed|credentials|invalid login|password/i.test(s)) return 'smtp_auth';
  if (/timeout|timed out|etimedout/i.test(s)) return 'timeout';
  if (/enotfound|econnrefused|econnreset|network|getaddrinfo|unreachable/i.test(s)) return 'network';
  if (/550|554|551|553|mailbox unavailable|recipient|user unknown|does not exist/i.test(s)) return 'recipient';
  if (/421|452|quota|storage|mailbox full/i.test(s)) return 'mailbox_full';
  if (/tls|ssl|certificate|starttls/i.test(s)) return 'tls';
  return 'other';
}

async function listFailedLocations(dataDir, tenantId) {
  const root = outboxRoot(dataDir);
  await migrateLegacyFlatOutbox(root);
  let locs = await collectJsonFilesInState(root, 'failed');
  if (tenantId) {
    const tid = safeTenantId(tenantId);
    locs = locs.filter((l) => l.tenantId === tid);
  }
  return locs;
}

export async function listFailedOutboxMessages(dataDir, { tenantId, limit = 100 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const locs = await listFailedLocations(dataDir, tenantId);
  const rows = [];
  for (const loc of locs) {
    const raw = await readFile(join(loc.dir, loc.file), 'utf8');
    const msg = JSON.parse(raw);
    rows.push({
      ...msg,
      folder: 'failed',
      tenantId: msg.tenantId ?? loc.tenantId,
      errorClass: classifyOutboxLastError(msg.lastError),
    });
  }
  rows.sort((a, b) => Date.parse(b.sentAt || b.createdAt || 0) - Date.parse(a.sentAt || b.createdAt || 0));
  return rows.slice(0, max);
}

export async function bulkRequeueFailedOutbox(dataDir, { ids = [], tenantId, all = false } = {}) {
  const results = { ok: true, requeued: 0, errors: [] };
  let targetIds = ids.filter(Boolean);
  if (all) {
    const failed = await listFailedOutboxMessages(dataDir, { tenantId, limit: 500 });
    targetIds = failed.map((r) => r.id);
  }
  if (!targetIds.length) {
    return { ok: false, error: 'ids veya all=true gerekli', requeued: 0, errors: [] };
  }
  for (const id of targetIds) {
    const hit = await findOutboxMessageById(dataDir, id);
    if (!hit) {
      results.errors.push({ id, error: 'Bulunamadı' });
      continue;
    }
    if (tenantId && safeTenantId(hit.message.tenantId) !== safeTenantId(tenantId)) {
      results.errors.push({ id, error: 'Tenant uyuşmuyor' });
      continue;
    }
    const r = await requeueFailedOutboxMessage(dataDir, id);
    if (r.ok) results.requeued += 1;
    else results.errors.push({ id, error: r.error ?? 'Requeue başarısız' });
  }
  return results;
}

async function filterFailedLocationsByIds(locs, ids) {
  const idSet = new Set(ids);
  const out = [];
  for (const loc of locs) {
    const msg = JSON.parse(await readFile(join(loc.dir, loc.file), 'utf8'));
    if (idSet.has(msg.id)) out.push(loc);
  }
  return out;
}

/** failed/*.json → failed/archive/{tenantId}/ */
export async function archiveFailedOutboxMessages(dataDir, { tenantId, ids = [], all = false } = {}) {
  if (!all && (!ids || ids.length === 0)) {
    return { ok: false, error: 'Arşiv için id listesi veya all=true gerekli' };
  }
  const root = outboxRoot(dataDir);
  await migrateLegacyFlatOutbox(root);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  let locs = await listFailedLocations(dataDir, tenantId);
  if (!all) locs = await filterFailedLocationsByIds(locs, ids);
  let archived = 0;
  for (const loc of locs) {
    const archiveDir = join(dirFailed(root), 'archive', loc.tenantId);
    await mkdir(archiveDir, { recursive: true });
    const src = join(loc.dir, loc.file);
    const dest = join(archiveDir, `${stamp}-${loc.file}`);
    await rename(src, dest);
    archived += 1;
  }
  return { ok: true, archived };
}

export async function readOutboxStateMessages(dataDir, state, { tenantId, limit = 400 } = {}) {
  const root = outboxRoot(dataDir);
  await migrateLegacyFlatOutbox(root);
  let locs = await collectJsonFilesInState(root, state);
  if (tenantId) {
    const tid = safeTenantId(tenantId);
    locs = locs.filter((l) => l.tenantId === tid);
  }
  const rows = [];
  for (const loc of locs) {
    const msg = JSON.parse(await readFile(join(loc.dir, loc.file), 'utf8'));
    rows.push({ ...msg, folder: state, tenantId: msg.tenantId ?? loc.tenantId });
  }
  rows.sort((a, b) => Date.parse(b.sentAt || b.createdAt || 0) - Date.parse(a.sentAt || b.createdAt || 0));
  return rows.slice(0, Math.min(Math.max(limit, 1), 2000));
}
