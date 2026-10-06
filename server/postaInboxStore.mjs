import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { messageDedupeKey } from './billEmailInboxStore.mjs';

function storeRoot(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-inbox', tenantId);
}

async function ensureDir(dataDir, tenantId) {
  const root = storeRoot(dataDir, tenantId);
  await mkdir(root, { recursive: true });
  return root;
}

function indexPath(root) {
  return join(root, 'messages.json');
}

async function readIndex(root) {
  try {
    const parsed = JSON.parse(await readFile(indexPath(root), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.messages ?? [];
  } catch {
    return [];
  }
}

async function writeIndex(root, messages) {
  await writeFile(indexPath(root), JSON.stringify(messages.slice(0, 500), null, 2), 'utf8');
}

export async function savePostaImapBatch(dataDir, tenantId, entries) {
  const root = await ensureDir(dataDir, tenantId);
  const existing = await readIndex(root);
  const keys = new Set(existing.map((r) => r.dedupeKey));
  const added = [];

  for (const entry of entries) {
    const dedupeKey = messageDedupeKey(entry);
    if (keys.has(dedupeKey)) continue;
    keys.add(dedupeKey);
    const row = {
      id: `pi-${randomUUID()}`,
      dedupeKey,
      kind: 'imap',
      imapUid: entry.imapUid ?? null,
      messageId: entry.messageId ?? null,
      from: entry.from ?? '',
      to: entry.to ?? '',
      subject: entry.subject ?? '',
      receivedAt: entry.receivedAt ?? new Date().toISOString(),
      snippet: entry.snippet ?? '',
      bodyText: entry.bodyText ?? '',
      bodyHtml: entry.bodyHtml ?? '',
      readAt: null,
      archivedAt: null,
      ingestedAt: new Date().toISOString(),
    };
    added.push(row);
    existing.unshift(row);
  }

  await writeIndex(root, existing);
  return { added, total: existing.length };
}

export async function listPostaImapMessages(dataDir, tenantId, { limit = 50, archived = false } = {}) {
  const root = await ensureDir(dataDir, tenantId);
  let rows = await readIndex(root);
  rows = rows.filter((r) => (archived ? Boolean(r.archivedAt) : !r.archivedAt));
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return rows.slice(0, max);
}

export async function updatePostaImapMessage(dataDir, tenantId, id, patch) {
  const root = await ensureDir(dataDir, tenantId);
  const rows = await readIndex(root);
  const idx = rows.findIndex((r) => r.id === id);
  if (idx < 0) return { ok: false, error: 'Kayıt bulunamadı' };
  rows[idx] = { ...rows[idx], ...patch, updatedAt: new Date().toISOString() };
  await writeIndex(root, rows);
  return { ok: true, message: rows[idx] };
}
