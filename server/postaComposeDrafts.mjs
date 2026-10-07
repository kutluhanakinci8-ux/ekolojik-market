import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function draftsPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-inbox', tenantId, 'compose-drafts.json');
}

async function readDrafts(dataDir, tenantId) {
  try {
    const parsed = JSON.parse(await readFile(draftsPath(dataDir, tenantId), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.drafts ?? [];
  } catch {
    return [];
  }
}

async function writeDrafts(dataDir, tenantId, rows) {
  await mkdir(join(dataDir, 'posta-inbox', tenantId), { recursive: true });
  await writeFile(draftsPath(dataDir, tenantId), JSON.stringify(rows.slice(0, 50), null, 2), 'utf8');
}

export async function listPostaComposeDrafts(dataDir, tenantId = 'main') {
  const rows = await readDrafts(dataDir, tenantId);
  rows.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return { ok: true, drafts: rows };
}

export async function upsertPostaComposeDraft(dataDir, tenantId, payload) {
  const to = String(payload.to ?? '').trim();
  const subject = String(payload.subject ?? '').trim();
  const body = String(payload.body ?? '');
  if (!to && !subject && !body.trim()) {
    return { ok: false, error: 'Boş taslak kaydedilemez' };
  }
  const rows = await readDrafts(dataDir, tenantId);
  const id = payload.id ? String(payload.id) : `draft-${randomUUID()}`;
  const now = new Date().toISOString();
  const row = {
    id,
    to,
    cc: String(payload.cc ?? '').trim(),
    bcc: String(payload.bcc ?? '').trim(),
    subject,
    body,
    inReplyTo: payload.inReplyTo ?? null,
    references: payload.references ?? null,
    updatedAt: now,
  };
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
  else rows.unshift(row);
  await writeDrafts(dataDir, tenantId, rows);
  return { ok: true, draft: row };
}

export async function deletePostaComposeDraft(dataDir, tenantId, id) {
  const rows = await readDrafts(dataDir, tenantId);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return { ok: false, error: 'Taslak bulunamadı' };
  await writeDrafts(dataDir, tenantId, next);
  return { ok: true };
}
