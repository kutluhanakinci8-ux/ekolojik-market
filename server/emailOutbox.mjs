import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const MAX_ATTEMPTS = 3;
const RETRY_SECONDS = [60, 120, 300];

function outboxRoot(dataDir) {
  return join(dataDir, 'email-outbox');
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

async function ensureDirs(dataDir) {
  const root = outboxRoot(dataDir);
  await mkdir(dirPending(root), { recursive: true });
  await mkdir(dirSent(root), { recursive: true });
  await mkdir(dirFailed(root), { recursive: true });
  return root;
}

function hashIdempotency(key) {
  return createHash('sha256').update(key).digest('hex').slice(0, 24);
}

export async function findOutboxByIdempotency(dataDir, idempotencyKey) {
  if (!idempotencyKey?.trim()) return null;
  const root = outboxRoot(dataDir);
  const tag = hashIdempotency(idempotencyKey.trim());
  for (const sub of ['pending', 'sent', 'failed']) {
    const dir = join(root, sub);
    try {
      const files = await readdir(dir);
      const hit = files.find((f) => f.includes(tag));
      if (hit) {
        const raw = await readFile(join(dir, hit), 'utf8');
        return JSON.parse(raw);
      }
    } catch {
      /* missing dir */
    }
  }
  return null;
}

export async function enqueueEkolojikMail(
  dataDir,
  {
    to,
    subject,
    text,
    html,
    fromName,
    idempotencyKey,
    source = 'crm',
    inReplyTo,
    references,
  },
) {
  await ensureDirs(dataDir);
  const key = idempotencyKey?.trim() || `ekolojik:${source}:${to}:${subject}:${Date.now()}`;
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
    subject,
    text: text ?? '',
    html: html ?? null,
    fromName: fromName ?? null,
    source,
    inReplyTo: inReplyTo ?? null,
    references: references ?? null,
    status: 'pending',
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    createdAt: new Date().toISOString(),
    nextAttemptAt: new Date().toISOString(),
    lastError: null,
    sentAt: null,
    providerMessageId: null,
  };

  const filename = `${message.createdAt.replace(/[:.]/g, '-')}_${tag}_${id}.json`;
  const path = join(dirPending(outboxRoot(dataDir)), filename);
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

export async function listRecentOutbox(dataDir, limit = 50) {
  const root = outboxRoot(dataDir);
  const pending = await listDirJson(dirPending(root), limit);
  const sent = await listDirJson(dirSent(root), limit);
  const failed = await listDirJson(dirFailed(root), limit);
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
  async function count(sub) {
    try {
      return (await readdir(join(root, sub))).filter((f) => f.endsWith('.json')).length;
    } catch {
      return 0;
    }
  }
  return {
    pending: await count('pending'),
    sent: await count('sent'),
    failed: await count('failed'),
  };
}

function isReady(message) {
  if (message.status !== 'pending') return false;
  const next = Date.parse(message.nextAttemptAt || message.createdAt);
  return Number.isFinite(next) && next <= Date.now();
}

export async function processPendingOutbox(dataDir, sendFn, { limit = 20 } = {}) {
  const root = await ensureDirs(dataDir);
  const pendingDir = dirPending(root);
  const files = (await readdir(pendingDir)).filter((f) => f.endsWith('.json')).sort();
  const results = { processed: 0, sent: 0, failed: 0, deferred: 0 };

  for (const file of files) {
    if (results.processed >= limit) break;
    const full = join(pendingDir, file);
    const message = JSON.parse(await readFile(full, 'utf8'));
    if (!isReady(message)) {
      results.deferred += 1;
      continue;
    }

    results.processed += 1;
    try {
      const sent = await sendFn(message);
      message.status = 'sent';
      message.sentAt = new Date().toISOString();
      message.providerMessageId = sent.messageId ?? null;
      message.lastError = null;
      const dest = join(dirSent(root), file);
      await writeFile(dest, JSON.stringify(message, null, 2), 'utf8');
      const { unlink } = await import('node:fs/promises');
      await unlink(full);
      results.sent += 1;
    } catch (error) {
      message.attempts = (message.attempts ?? 0) + 1;
      message.lastError = error instanceof Error ? error.message : String(error);
      if (message.attempts >= message.maxAttempts) {
        message.status = 'failed';
        const dest = join(dirFailed(root), file);
        await writeFile(dest, JSON.stringify(message, null, 2), 'utf8');
        const { unlink } = await import('node:fs/promises');
        await unlink(full);
        results.failed += 1;
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
  for (const sub of ['pending', 'sent', 'failed']) {
    const dir = join(root, sub);
    try {
      const files = await readdir(dir);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const raw = await readFile(join(dir, f), 'utf8');
        const msg = JSON.parse(raw);
        if (msg.id === id) {
          return { message: msg, folder: sub, file: f };
        }
      }
    } catch {
      /* skip */
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
  message.status = 'pending';
  message.attempts = 0;
  message.lastError = null;
  message.nextAttemptAt = new Date().toISOString();
  const dest = join(dirPending(root), hit.file);
  await writeFile(dest, JSON.stringify(message, null, 2), 'utf8');
  const { unlink } = await import('node:fs/promises');
  await unlink(join(dirFailed(root), hit.file));
  return { ok: true, message };
}
