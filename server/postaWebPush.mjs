import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import webpush from 'web-push';

function subsPath(dataDir) {
  return join(dataDir, 'posta-push', 'subscriptions.json');
}

function getVapidEnv() {
  const publicKey = process.env.EKOLOJIK_PUSH_VAPID_PUBLIC_KEY?.trim() ?? '';
  const privateKey = process.env.EKOLOJIK_PUSH_VAPID_PRIVATE_KEY?.trim() ?? '';
  const subject =
    process.env.EKOLOJIK_PUSH_VAPID_SUBJECT?.trim() || 'mailto:info@ekolojikmarket.com.tr';
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject };
}

export function isPostaWebPushConfigured() {
  return Boolean(getVapidEnv());
}

export function getPostaPushConfig() {
  const vapid = getVapidEnv();
  return {
    ok: true,
    configured: Boolean(vapid),
    publicKey: vapid?.publicKey ?? null,
    subject: vapid?.subject ?? null,
    hint: vapid
      ? null
      : 'EKOLOJIK_PUSH_VAPID_PUBLIC_KEY / EKOLOJIK_PUSH_VAPID_PRIVATE_KEY tanımlayın (web-push generate-vapid-keys)',
  };
}

async function readSubscriptions(dataDir) {
  try {
    const rows = JSON.parse(await readFile(subsPath(dataDir), 'utf8'));
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function writeSubscriptions(dataDir, rows) {
  await mkdir(join(dataDir, 'posta-push'), { recursive: true });
  await writeFile(subsPath(dataDir), JSON.stringify(rows.slice(0, 200), null, 2), 'utf8');
}

export async function savePostaPushSubscription(dataDir, subscription, meta = {}) {
  if (!subscription?.endpoint) {
    return { ok: false, error: 'Geçersiz push aboneliği' };
  }
  const rows = await readSubscriptions(dataDir);
  const endpoint = String(subscription.endpoint);
  const row = {
    id: randomUUID(),
    endpoint,
    subscription,
    userAgent: meta.userAgent ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const idx = rows.findIndex((r) => r.endpoint === endpoint);
  if (idx >= 0) {
    rows[idx] = { ...rows[idx], subscription, updatedAt: row.updatedAt, userAgent: row.userAgent };
  } else {
    rows.unshift(row);
  }
  await writeSubscriptions(dataDir, rows);
  return { ok: true, count: rows.length };
}

export async function removePostaPushSubscription(dataDir, endpoint) {
  const ep = String(endpoint ?? '').trim();
  if (!ep) return { ok: false, error: 'endpoint gerekli' };
  const rows = await readSubscriptions(dataDir);
  const next = rows.filter((r) => r.endpoint !== ep);
  await writeSubscriptions(dataDir, next);
  return { ok: true, removed: rows.length - next.length };
}

export async function listPostaPushSubscriptionCount(dataDir) {
  const rows = await readSubscriptions(dataDir);
  return { ok: true, count: rows.length };
}

function applyVapid() {
  const vapid = getVapidEnv();
  if (!vapid) return null;
  webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  return vapid;
}

export async function sendPostaWebPush(dataDir, payload) {
  const vapid = applyVapid();
  if (!vapid) return { ok: false, skipped: true, error: 'VAPID yapılandırılmadı' };

  const body = JSON.stringify({
    title: payload.title ?? 'Ekolojik Posta',
    body: payload.body ?? '',
    url: payload.url ?? '/',
    tag: payload.tag ?? 'ekolojik-posta',
  });

  const rows = await readSubscriptions(dataDir);
  let sent = 0;
  let failed = 0;
  const stale = [];

  for (const row of rows) {
    try {
      await webpush.sendNotification(row.subscription, body);
      sent += 1;
    } catch (error) {
      failed += 1;
      const status = error?.statusCode;
      if (status === 404 || status === 410) stale.push(row.endpoint);
    }
  }

  if (stale.length) {
    const next = rows.filter((r) => !stale.includes(r.endpoint));
    await writeSubscriptions(dataDir, next);
  }

  return { ok: true, sent, failed, stale: stale.length, subscribers: rows.length };
}

/** Hub uyarıları / mesajlaşma → PWA push (NB PM-4) */
export async function notifyPostaWebPushLite(dataDir, { title, body, url, tag }) {
  return sendPostaWebPush(dataDir, { title, body, url, tag });
}
