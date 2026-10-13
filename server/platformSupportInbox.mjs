/** Platform destek@ gelen kutusu — IMAP senkron, yanıt, otomatik alındı */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fetchRecentMailboxMessages, verifyImapMailbox } from './billEmailImap.mjs';
import { parseMailBody, repairUtf8Mojibake } from './mailBodyParse.mjs';
import { parseThreadHeadersFromRaw } from './postaConversation.mjs';
import { supportInboxStatus } from './platformSupportMailConfig.mjs';
import { messageDedupeKey } from './billEmailInboxStore.mjs';
import {
  getPlatformSupportImapConfig,
  isPlatformSupportImapConfigured,
  getPlatformSupportMailPresentation,
} from './platformSupportMailConfig.mjs';
import { sendViaEkolojikSmtp } from './ekolojikSmtp.mjs';
import { PLATFORM_TENANT_ID } from './platformOperators.mjs';

const INBOX_DIR = (dataDir) => join(dataDir, 'platform', 'support-inbox');
const MESSAGES_FILE = (dataDir) => join(INBOX_DIR(dataDir), 'messages.json');
const META_FILE = (dataDir) => join(INBOX_DIR(dataDir), 'meta.json');

async function ensureStore(dataDir) {
  await mkdir(INBOX_DIR(dataDir), { recursive: true });
}

async function readMessages(dataDir) {
  try {
    const parsed = JSON.parse(await readFile(MESSAGES_FILE(dataDir), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.messages ?? [];
  } catch {
    return [];
  }
}

async function writeMessages(dataDir, messages) {
  await ensureStore(dataDir);
  await writeFile(MESSAGES_FILE(dataDir), JSON.stringify(messages.slice(0, 500), null, 2), 'utf8');
}

function dedupeKey(entry) {
  if (entry.messageId?.trim()) return `mid:${entry.messageId.trim()}`;
  return messageDedupeKey(entry);
}

function formatAutoreplyText({ fromName, messageId }) {
  const brand = fromName || 'Ekolojik Market';
  return [
    'Merhaba,',
    '',
    `${brand} destek ekibine yazdığınız için teşekkür ederiz.`,
    'Talebiniz alındı; en kısa sürede size dönüş yapacağız.',
    '',
    `Referans: ${messageId}`,
    '',
    '— Ekolojik Destek',
    'destek@ekolojikmarket.com.tr',
  ].join('\n');
}

async function sendSupportMail(dataDir, { to, subject, text, html, inReplyTo, references }) {
  const pres = getPlatformSupportMailPresentation();
  return sendViaEkolojikSmtp({
    dataDir,
    tenantId: PLATFORM_TENANT_ID,
    to,
    subject,
    text,
    html,
    fromName: pres.fromName,
    fromEmail: pres.from,
    replyTo: pres.replyTo,
    inReplyTo,
    references,
  });
}

async function maybeSendAutoreply(dataDir, row) {
  if (row.autoreplySentAt) return { skipped: true };
  const from = String(row.from ?? '').match(/[\w.+-]+@[\w.-]+/)?.[0];
  if (!from?.includes('@')) return { skipped: true, reason: 'no_from' };
  const pres = getPlatformSupportMailPresentation();
  const subject = row.subject?.toLowerCase().startsWith('re:')
    ? row.subject
    : `Re: ${row.subject || 'Destek talebiniz'}`;
  const text = formatAutoreplyText({ fromName: pres.fromName, messageId: row.id });
  const result = await sendSupportMail(dataDir, {
    to: from,
    subject,
    text,
    inReplyTo: row.messageId,
    references: row.references || row.messageId,
  });
  return { ok: Boolean(result?.messageId), ...result };
}

export async function syncPlatformSupportInbox(dataDir, { maxMessages = 40 } = {}) {
  if (!isPlatformSupportImapConfigured()) {
    return { ok: false, error: 'destek@ IMAP yapılandırılmadı (EKOLOJIK_SUPPORT_IMAP_*)' };
  }
  const config = getPlatformSupportImapConfig();
  try {
    await verifyImapMailbox(config);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'IMAP bağlantı hatası' };
  }

  const sinceDate = new Date(Date.now() - 60 * 86400000);
  let fetched = [];
  try {
    fetched = await fetchRecentMailboxMessages(config, 'INBOX', {
      sinceDate,
      maxMessages,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'IMAP tarama hatası' };
  }

  const existing = await readMessages(dataDir);
  const byKey = new Map(existing.map((r) => [r.dedupeKey, r]));
  let added = 0;
  const autoreplies = [];

  for (const msg of fetched) {
    const raw = msg.rawSource || msg.text || '';
    const parsed = parseMailBody(raw);
    const threadHdr = parseThreadHeadersFromRaw(raw);
    const dedupe = dedupeKey(msg);
    if (byKey.has(dedupe)) continue;

    const row = {
      id: `ps-${randomUUID()}`,
      dedupeKey: dedupe,
      messageId: msg.messageId ?? null,
      inReplyTo: threadHdr.inReplyTo ?? null,
      references: threadHdr.references ?? null,
      from: repairUtf8Mojibake(msg.from ?? ''),
      to: repairUtf8Mojibake(msg.to ?? ''),
      subject: repairUtf8Mojibake(msg.subject ?? ''),
      receivedAt: msg.receivedAt ?? new Date().toISOString(),
      snippet: repairUtf8Mojibake(parsed.snippet || msg.snippet || ''),
      bodyText: repairUtf8Mojibake(parsed.text ?? ''),
      bodyHtml: repairUtf8Mojibake(parsed.html ?? ''),
      readAt: null,
      autoreplySentAt: null,
      externalTicketRef: null,
      ingestedAt: new Date().toISOString(),
    };
    byKey.set(dedupe, row);
    added += 1;

    const ar = await maybeSendAutoreply(dataDir, row);
    if (ar?.ok) {
      row.autoreplySentAt = new Date().toISOString();
    }
    autoreplies.push({ id: row.id, ...ar });
  }

  const merged = [...byKey.values()].sort(
    (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
  );
  await writeMessages(dataDir, merged);
  await writeFile(
    META_FILE(dataDir),
    JSON.stringify({ lastSyncAt: new Date().toISOString(), added, scanned: fetched.length }, null, 2),
    'utf8',
  );

  return {
    ok: true,
    scanned: fetched.length,
    added,
    autoreplies,
    message: `${fetched.length} tarandı · ${added} yeni`,
  };
}

export async function listPlatformSupportInbox(dataDir, { limit = 50 } = {}) {
  const messages = await readMessages(dataDir);
  const unread = messages.filter((m) => !m.readAt).length;
  let lastSyncAt = null;
  try {
    const meta = JSON.parse(await readFile(META_FILE(dataDir), 'utf8'));
    lastSyncAt = meta.lastSyncAt ?? null;
  } catch {
    /* */
  }
  return {
    mailbox: supportInboxStatus(),
    lastSyncAt,
    messages: messages.slice(0, Math.min(limit, 100)),
    unread,
    total: messages.length,
  };
}

export async function getPlatformSupportInboxMessage(dataDir, id) {
  const messages = await readMessages(dataDir);
  const row = messages.find((m) => m.id === id);
  if (!row) return null;
  if (!row.readAt) {
    row.readAt = new Date().toISOString();
    await writeMessages(dataDir, messages);
  }
  return row;
}

export async function replyPlatformSupportInbox(dataDir, { messageId, body, operatorUsername }) {
  const messages = await readMessages(dataDir);
  const row = messages.find((m) => m.id === messageId);
  if (!row) return { ok: false, error: 'Mesaj bulunamadı' };
  const to = String(row.from ?? '').match(/[\w.+-]+@[\w.-]+/)?.[0];
  if (!to?.includes('@')) return { ok: false, error: 'Gönderici e-posta çıkarılamadı' };

  const text = String(body ?? '').trim();
  if (!text) return { ok: false, error: 'Yanıt metni gerekli' };

  const subject = row.subject?.toLowerCase().startsWith('re:') ? row.subject : `Re: ${row.subject || 'Destek'}`;
  const signed = `${text}\n\n— ${operatorUsername || 'Ekolojik Platform'}`;
  const result = await sendSupportMail(dataDir, {
    to,
    subject,
    text: signed,
    inReplyTo: row.messageId,
    references: row.references || row.messageId,
  });
  if (!result?.messageId) {
    return { ok: false, error: 'SMTP gönderimi başarısız' };
  }
  row.repliedAt = new Date().toISOString();
  row.repliedBy = operatorUsername ?? null;
  await writeMessages(dataDir, messages);
  return { ok: true, to, result };
}
