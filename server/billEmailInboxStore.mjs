import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

function inboxRoot(dataDir, tenantId = 'main') {
  return join(dataDir, 'bill-email-inbox', tenantId);
}

async function ensureInboxDir(dataDir, tenantId) {
  const root = inboxRoot(dataDir, tenantId);
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
  const max = 500;
  const trimmed = messages.slice(0, max);
  await writeFile(indexPath(root), JSON.stringify(trimmed, null, 2), 'utf8');
}

export function messageDedupeKey({ messageId, imapUid, subject, receivedAt }) {
  if (messageId?.trim()) return `mid:${messageId.trim()}`;
  return `uid:${imapUid ?? 0}:${receivedAt ?? ''}:${(subject ?? '').slice(0, 80)}`;
}

export async function listBillEmailInbox(dataDir, tenantId, { limit = 50, sourceId } = {}) {
  const root = await ensureInboxDir(dataDir, tenantId);
  let rows = await readIndex(root);
  if (sourceId) {
    rows = rows.filter((r) => r.sourceId === sourceId);
  }
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return { ok: true, messages: rows.slice(0, max) };
}

export async function saveBillEmailInboxBatch(dataDir, tenantId, entries) {
  const root = await ensureInboxDir(dataDir, tenantId);
  const existing = await readIndex(root);
  const keys = new Set(existing.map((r) => r.dedupeKey));
  const added = [];

  for (const entry of entries) {
    const dedupeKey = messageDedupeKey(entry);
    if (keys.has(dedupeKey)) continue;
    keys.add(dedupeKey);
    const row = {
      id: `be-${randomUUID()}`,
      dedupeKey,
      imapUid: entry.imapUid ?? null,
      messageId: entry.messageId ?? null,
      sourceId: entry.sourceId ?? null,
      sourceLabel: entry.sourceLabel ?? null,
      from: entry.from ?? '',
      to: entry.to ?? '',
      subject: entry.subject ?? '',
      receivedAt: entry.receivedAt ?? new Date().toISOString(),
      snippet: entry.snippet ?? '',
      amount: entry.amount ?? null,
      dueDate: entry.dueDate ?? null,
      matched: Boolean(entry.sourceId),
      ingestedAt: new Date().toISOString(),
    };
    added.push(row);
    existing.unshift(row);
  }

  await writeIndex(root, existing);
  return { added, total: existing.length };
}
