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

function entryDedupeKey(entry) {
  if (entry.messageId?.trim()) return `mid:${entry.messageId.trim()}`;
  return messageDedupeKey(entry);
}

export async function savePostaImapBatch(dataDir, tenantId, entries) {
  const root = await ensureDir(dataDir, tenantId);
  const existing = await readIndex(root);
  const byKey = new Map(existing.map((r) => [r.dedupeKey, r]));
  const added = [];
  const updated = [];

  for (const entry of entries) {
    const dedupeKey = entryDedupeKey(entry);
    const prev = byKey.get(dedupeKey);
    const patch = {
      dedupeKey,
      kind: 'imap',
      imapUid: entry.imapUid ?? null,
      imapFolder: entry.imapFolder ?? 'inbox',
      imapMailboxPath: entry.imapMailboxPath ?? 'INBOX',
      messageId: entry.messageId ?? null,
      from: entry.from ?? '',
      to: entry.to ?? '',
      subject: entry.subject ?? '',
      receivedAt: entry.receivedAt ?? new Date().toISOString(),
      snippet: entry.snippet ?? '',
      bodyText: entry.bodyText ?? '',
      bodyHtml: entry.bodyHtml ?? '',
      attachments: entry.attachments ?? [],
    };

    if (prev) {
      Object.assign(prev, patch, { updatedAt: new Date().toISOString() });
      updated.push(prev);
      continue;
    }

    const row = {
      id: `pi-${randomUUID()}`,
      ...patch,
      readAt: null,
      archivedAt: null,
      ingestedAt: new Date().toISOString(),
    };
    added.push(row);
    byKey.set(dedupeKey, row);
    existing.unshift(row);
  }

  await writeIndex(root, existing);
  return { added, updated, total: existing.length };
}

export async function listPostaImapMessages(
  dataDir,
  tenantId,
  { limit = 50, archived = false, imapFolder = null } = {},
) {
  const root = await ensureDir(dataDir, tenantId);
  let rows = await readIndex(root);
  rows = rows.filter((r) => (archived ? Boolean(r.archivedAt) : !r.archivedAt));
  if (imapFolder) {
    const want = String(imapFolder).toLowerCase();
    rows = rows.filter((r) => (r.imapFolder ?? 'inbox').toLowerCase() === want);
  }
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return rows.slice(0, max);
}

export async function findPostaImapMessage(dataDir, tenantId, id) {
  const root = await ensureDir(dataDir, tenantId);
  const rows = await readIndex(root);
  return rows.find((r) => r.id === id) ?? null;
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
