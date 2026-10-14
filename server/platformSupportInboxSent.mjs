/** Platform destek@ — giden yanıtlar (case e-posta thread + gelen kutusu yanıtları) */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { supportInboxStatus } from './platformSupportMailConfig.mjs';

const INBOX_MESSAGES = (dataDir) => join(dataDir, 'platform', 'support-inbox', 'messages.json');

function extractEmail(fromLabel) {
  return String(fromLabel ?? '').match(/[\w.+-]+@[\w.-]+/)?.[0] ?? null;
}

const OUTBOUND_KIND_LABELS = {
  operator_reply: 'Operatör yanıtı',
  autoreply: 'Otomatik alındı',
  spawn_notify: 'Yeni kayıt bildirimi',
  outbound: 'Giden',
};

async function readInboxMessages(dataDir) {
  try {
    const parsed = JSON.parse(await readFile(INBOX_MESSAGES(dataDir), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.messages ?? [];
  } catch {
    return [];
  }
}

export async function listPlatformSupportSentReplies(dataDir, { limit = 80 } = {}) {
  const { readPlatformCases } = await import('./platformCaseStore.mjs');
  const cases = await readPlatformCases(dataDir);
  const inboxRows = await readInboxMessages(dataDir);
  const items = [];
  const seen = new Set();

  for (const c of cases) {
    const events = c.links?.emailThread?.events ?? [];
    for (let idx = 0; idx < events.length; idx += 1) {
      const e = events[idx];
      const key = `case:${c.id}:${e.at}:${e.messageId ?? idx}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items.push({
        id: `sent-${c.id}-${idx}-${Date.parse(e.at) || idx}`,
        sentAt: e.at,
        kind: e.kind ?? 'outbound',
        kindLabel: OUTBOUND_KIND_LABELS[e.kind] ?? e.kind ?? 'Giden',
        to: c.requesterEmail ?? null,
        subject: c.subject ?? null,
        preview: e.textPreview ?? null,
        htmlPreview: e.htmlPreview ?? null,
        messageId: e.messageId ?? null,
        caseNumber: c.number,
        caseId: c.id,
        inboxMessageId: e.inboxMessageId ?? c.links?.inboxMessageId ?? null,
        repliedBy: null,
      });
    }
  }

  for (const row of inboxRows) {
    if (!row.repliedAt) continue;
    const key = `inbox:${row.id}`;
    if (seen.has(key)) continue;
    const dupCase = items.some(
      (it) => it.inboxMessageId === row.id && it.kind === 'operator_reply' && it.sentAt === row.repliedAt,
    );
    if (dupCase) continue;
    seen.add(key);
    items.push({
      id: `sent-inbox-${row.id}`,
      sentAt: row.repliedAt,
      kind: 'operator_reply',
      kindLabel: OUTBOUND_KIND_LABELS.operator_reply,
      to: extractEmail(row.from),
      subject: row.subject ?? null,
      preview: row.lastOutboundPreview ?? row.snippet ?? null,
      htmlPreview: row.lastOutboundHtml ?? null,
      messageId: row.outboundMessageIds?.[row.outboundMessageIds.length - 1] ?? null,
      caseNumber: null,
      caseId: null,
      inboxMessageId: row.id,
      repliedBy: row.repliedBy ?? null,
    });
  }

  items.sort((a, b) => Date.parse(b.sentAt) - Date.parse(a.sentAt));
  const max = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const slice = items.slice(0, max);

  return {
    mailbox: supportInboxStatus(),
    folder: 'sent',
    messages: slice,
    total: items.length,
    lastSyncAt: null,
    unread: 0,
  };
}
