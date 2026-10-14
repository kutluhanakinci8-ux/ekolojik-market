/** Paylaşımlı posta kutusu — delegasyon (okuma / gönderme / send-as) */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function path(dataDir, tenantId) {
  return join(dataDir, 'posta-delegates', `${tenantId}.json`);
}

export async function readPostaDelegates(dataDir, tenantId = 'main') {
  try {
    const raw = JSON.parse(await readFile(path(dataDir, tenantId), 'utf8'));
    const delegates = Array.isArray(raw.delegates) ? raw.delegates : [];
    return {
      ok: true,
      tenantId,
      sharedMailboxModel: 'business_inbox',
      exchangeStyleFullDelegation: false,
      delegates: delegates.map(normalizeDelegate).filter(Boolean),
      sendAsAliases: Array.isArray(raw.sendAsAliases) ? raw.sendAsAliases.map(String) : [],
    };
  } catch {
    return {
      ok: true,
      tenantId,
      sharedMailboxModel: 'business_inbox',
      exchangeStyleFullDelegation: false,
      delegates: [],
      sendAsAliases: [],
    };
  }
}

function normalizeDelegate(row) {
  const userId = String(row?.userId ?? row?.username ?? '').trim();
  if (!userId) return null;
  const role = String(row?.role ?? 'read').trim().toLowerCase();
  const allowed = ['read', 'send', 'full'];
  return {
    userId,
    displayName: String(row?.displayName ?? userId).trim(),
    role: allowed.includes(role) ? role : 'read',
    sendAs: Array.isArray(row?.sendAs) ? row.sendAs.map(String) : [],
  };
}

export async function savePostaDelegates(dataDir, tenantId, payload) {
  const delegates = (Array.isArray(payload?.delegates) ? payload.delegates : [])
    .map(normalizeDelegate)
    .filter(Boolean);
  const sendAsAliases = Array.isArray(payload?.sendAsAliases)
    ? payload.sendAsAliases.map((a) => String(a).trim()).filter(Boolean)
    : [];
  await mkdir(join(dataDir, 'posta-delegates'), { recursive: true });
  await writeFile(
    path(dataDir, tenantId),
    JSON.stringify({ delegates, sendAsAliases, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
  return readPostaDelegates(dataDir, tenantId);
}

export async function userHasDelegatedPostaAccess(dataDir, tenantId, user) {
  if (!user?.id && !user?.username) return false;
  const hub = await readPostaDelegates(dataDir, tenantId);
  const key = String(user.id ?? user.username).trim();
  const byName = String(user.username ?? '').trim().toLowerCase();
  return hub.delegates.some(
    (d) => d.userId === key || d.userId.toLowerCase() === byName,
  );
}
