/** Platform operatör @mention — uygulama içi bildirim kutusu */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const INBOX_PATH = (dataDir) => join(dataDir, 'platform', 'support-mention-inbox.json');

async function readInbox(dataDir) {
  try {
    const parsed = JSON.parse(await readFile(INBOX_PATH(dataDir), 'utf8'));
    return Array.isArray(parsed.items) ? parsed.items : [];
  } catch {
    return [];
  }
}

async function writeInbox(dataDir, items) {
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  const trimmed = items.slice(0, 500);
  await writeFile(INBOX_PATH(dataDir), JSON.stringify({ items: trimmed }, null, 2), 'utf8');
}

export async function recordMentionInboxItems(dataDir, { caseRow, mentions, authorUsername, noteBody }) {
  const items = await readInbox(dataDir);
  const now = new Date().toISOString();
  for (const username of mentions) {
    items.unshift({
      id: `mn-${randomUUID()}`,
      username: String(username).toLowerCase(),
      caseId: caseRow.id,
      caseNumber: caseRow.number,
      subject: caseRow.subject ?? '',
      authorUsername,
      preview: String(noteBody ?? '').slice(0, 280),
      readAt: null,
      createdAt: now,
    });
  }
  await writeInbox(dataDir, items);
}

export async function listMentionInboxForUser(dataDir, username, { limit = 40 } = {}) {
  const u = String(username ?? '').trim().toLowerCase();
  const items = await readInbox(dataDir);
  const mine = items.filter((i) => i.username === u).slice(0, Math.min(limit, 100));
  const unread = mine.filter((i) => !i.readAt).length;
  return { ok: true, items: mine, unread };
}

export async function markMentionInboxRead(dataDir, username, { ids } = {}) {
  const u = String(username ?? '').trim().toLowerCase();
  const idSet = new Set((ids ?? []).map((id) => String(id)));
  const items = await readInbox(dataDir);
  const now = new Date().toISOString();
  let marked = 0;
  for (const item of items) {
    if (item.username !== u) continue;
    if (idSet.size && !idSet.has(item.id)) continue;
    if (!item.readAt) {
      item.readAt = now;
      marked += 1;
    }
  }
  await writeInbox(dataDir, items);
  return { ok: true, marked };
}
