import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function flagsPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-inbox', tenantId, 'flags.json');
}

async function readFlags(dataDir, tenantId) {
  try {
    const parsed = JSON.parse(await readFile(flagsPath(dataDir, tenantId), 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

async function writeFlags(dataDir, tenantId, map) {
  await mkdir(join(dataDir, 'posta-inbox', tenantId), { recursive: true });
  await writeFile(flagsPath(dataDir, tenantId), JSON.stringify(map, null, 2), 'utf8');
}

export async function getPostaInboxFlagsMap(dataDir, tenantId = 'main') {
  return readFlags(dataDir, tenantId);
}

export function applyPostaFlagsToItem(item, flagsMap) {
  const f = flagsMap[item.id] ?? {};
  const snoozedUntil = f.snoozedUntil ?? null;
  const snoozeActive = snoozedUntil && Date.parse(snoozedUntil) > Date.now();
  const labels = Array.isArray(f.labels) ? f.labels.filter(Boolean) : [];
  return {
    ...item,
    starred: Boolean(f.starred),
    spam: Boolean(f.spam),
    trashed: Boolean(f.trashed),
    snoozedUntil,
    snoozeActive,
    labels,
  };
}

export async function patchPostaInboxFlags(dataDir, tenantId, id, patch) {
  if (!id) return { ok: false, error: 'id gerekli' };
  const map = await readFlags(dataDir, tenantId);
  const prev = map[id] ?? {};
  const next = { ...prev };
  if (patch.starred != null) next.starred = Boolean(patch.starred);
  if (patch.spam != null) next.spam = Boolean(patch.spam);
  if (patch.trashed != null) next.trashed = Boolean(patch.trashed);
  if (patch.snoozedUntil !== undefined) {
    next.snoozedUntil = patch.snoozedUntil || null;
  }
  if (patch.labels != null) {
    const add = Array.isArray(patch.labels) ? patch.labels : [];
    const merged = new Set([...(Array.isArray(prev.labels) ? prev.labels : []), ...add].map(String));
    next.labels = [...merged].filter(Boolean);
  }
  map[id] = next;
  await writeFlags(dataDir, tenantId, map);
  return { ok: true, flags: next };
}
