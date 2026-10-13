/** Platform destek@ gelen kutusu — IMAP senkron, yanıt, otomatik alındı */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { fetchRecentMailboxMessages, verifyImapMailbox } from './billEmailImap.mjs';
import { parseMailBody, repairUtf8Mojibake, turkishLetterScore } from './mailBodyParse.mjs';
import { parseThreadHeadersFromRaw } from './postaConversation.mjs';
import { supportInboxStatus } from './platformSupportMailConfig.mjs';
import { messageDedupeKey } from './billEmailInboxStore.mjs';
import {
  getPlatformSupportImapConfig,
  isPlatformSupportImapConfigured,
  getPlatformSupportMailPresentation,
  getPlatformSupportMailAddress,
} from './platformSupportMailConfig.mjs';
import { sendViaEkolojikSmtp } from './ekolojikSmtp.mjs';
import {
  buildPlatformSupportAutoreplyContent,
  buildPlatformSupportOperatorReplyContent,
} from './platformSupportAutoreplyTemplate.mjs';
import { PLATFORM_TENANT_ID } from './platformOperators.mjs';
import { listMergedRecentOutbox } from './emailOutbox.mjs';
import { readTenantStore } from './tenantAuth.mjs';

const INBOX_DIR = (dataDir) => join(dataDir, 'platform', 'support-inbox');
const SUPPORT_LOCAL = () => getPlatformSupportMailAddress().toLowerCase();
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
  if (entry.outboxId) return `outbox:${entry.outboxId}`;
  if (entry.messageId?.trim()) return `mid:${entry.messageId.trim()}`;
  return messageDedupeKey(entry);
}

function targetsSupportAddress(...parts) {
  const blob = parts.filter(Boolean).join(' ').toLowerCase();
  const needle = SUPPORT_LOCAL();
  return blob.includes(needle) || blob.includes('destek@ekolojikmarket');
}

async function senderLabelForOutbox(dataDir, message) {
  const tenantId = message.tenantId || 'main';
  const store = await readTenantStore(dataDir, tenantId);
  const business = String(store?.settings?.businessName ?? '').trim() || tenantId;
  const { getEffectiveMailPresentation } = await import('./postaSettings.mjs');
  const pres = await getEffectiveMailPresentation(dataDir, tenantId);
  const email = String(pres.replyTo || pres.from || '').trim() || 'posta@ekolojikmarket.com.tr';
  const name = String(message.fromName || pres.fromName || business).trim();
  return `${name} (${business}) <${email}>`;
}

export async function ingestSupportMailFromOutbox(dataDir, outboxMessage) {
  if (!outboxMessage?.id) return { skipped: true, reason: 'no_id' };
  if (!targetsSupportAddress(outboxMessage.to, outboxMessage.cc, outboxMessage.bcc)) {
    return { skipped: true, reason: 'not_support' };
  }

  const existing = await readMessages(dataDir);
  const key = `outbox:${outboxMessage.id}`;
  if (existing.some((r) => r.dedupeKey === key || r.outboxId === outboxMessage.id)) {
    return { skipped: true, reason: 'duplicate' };
  }

  const from = await senderLabelForOutbox(dataDir, outboxMessage);
  const bodyText = String(outboxMessage.text ?? '').trim();
  const snippet = bodyText.slice(0, 200) || String(outboxMessage.subject ?? '').slice(0, 120);
  const receivedAt = outboxMessage.sentAt || outboxMessage.createdAt || new Date().toISOString();

  const row = {
    id: `ps-${randomUUID()}`,
    dedupeKey: key,
    outboxId: outboxMessage.id,
    outboxStatus: outboxMessage.status ?? 'pending',
    tenantId: outboxMessage.tenantId ?? null,
    messageId: outboxMessage.providerMessageId ?? null,
    inReplyTo: outboxMessage.inReplyTo ?? null,
    references: outboxMessage.references ?? null,
    from,
    to: getPlatformSupportMailAddress(),
    subject: String(outboxMessage.subject ?? 'Destek'),
    receivedAt,
    snippet,
    bodyText,
    bodyHtml: outboxMessage.html ?? null,
    readAt: null,
    autoreplySentAt: null,
    externalTicketRef: null,
    source: 'outbox-bridge',
    ingestedAt: new Date().toISOString(),
  };

  const merged = [row, ...existing].sort((a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt));
  await writeMessages(dataDir, merged);

  const { autoCreateCaseForInboxRow } = await import('./platformSupportCases.mjs');
  await autoCreateCaseForInboxRow(dataDir, row);

  if (outboxMessage.status === 'sent') {
    const ar = await maybeSendAutoreply(dataDir, row);
    if (ar?.ok) {
      const refreshed = await readMessages(dataDir);
      const idx = refreshed.findIndex((r) => r.id === row.id);
      if (idx >= 0) {
        refreshed[idx] = { ...refreshed[idx], autoreplySentAt: new Date().toISOString() };
        await writeMessages(dataDir, refreshed);
      }
    }
  }

  return { ok: true, added: true, row };
}

export async function importSupportInboxFromOutbox(dataDir, { limit = 100 } = {}) {
  const rows = await listMergedRecentOutbox(dataDir, limit);
  let scanned = 0;
  let added = 0;
  for (const msg of rows) {
    if (!targetsSupportAddress(msg.to, msg.cc, msg.bcc)) continue;
    scanned += 1;
    const res = await ingestSupportMailFromOutbox(dataDir, msg);
    if (res.added) added += 1;
  }
  return { scanned, added };
}

export async function maybeIngestOutboxForSupport(dataDir, outboxMessage) {
  try {
    return await ingestSupportMailFromOutbox(dataDir, outboxMessage);
  } catch {
    return { skipped: true };
  }
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
  const { text, html } = buildPlatformSupportAutoreplyContent({
    messageId: row.id,
    brandName: pres.fromName,
  });
  const result = await sendSupportMail(dataDir, {
    to: from,
    subject,
    text,
    html,
    inReplyTo: row.messageId,
    references: row.references || row.messageId,
  });
  return { ok: Boolean(result?.messageId), ...result };
}

async function safeMaybeSendAutoreply(dataDir, row) {
  try {
    return await maybeSendAutoreply(dataDir, row);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Otomatik yanıt gönderilemedi',
    };
  }
}

function extractSenderEmail(fromLabel) {
  return String(fromLabel ?? '').match(/[\w.+-]+@[\w.-]+/)?.[0]?.toLowerCase() ?? '';
}

/** Dış müşteri IMAP maili — otomatik alındı (iç outbox / bounce hariç) */
function shouldAutoreplyForInboxRow(row) {
  if (row.autoreplySentAt) return false;
  if (row.source === 'outbox-bridge') return false;
  const from = extractSenderEmail(row.from);
  if (!from.includes('@')) return false;
  if (from.includes('mailer-daemon') || from.includes('postmaster')) return false;
  const support = getPlatformSupportMailAddress().toLowerCase();
  if (from === support) return false;
  return true;
}

async function applyAutoreplyIfNeeded(dataDir, row, autoreplies) {
  if (!shouldAutoreplyForInboxRow(row)) return;
  const ar = await safeMaybeSendAutoreply(dataDir, row);
  if (ar?.ok) {
    row.autoreplySentAt = new Date().toISOString();
  }
  autoreplies.push({ id: row.id, ...ar });
}

export async function importSupportInboxFromImap(
  dataDir,
  { maxMessages = 40, sendAutoreply: _sendAutoreply = true, sinceDays = 60 } = {},
) {
  if (!isPlatformSupportImapConfigured()) {
    return { ok: true, skipped: true, scanned: 0, added: 0, autoreplies: [] };
  }
  const config = getPlatformSupportImapConfig();
  const sinceDate = new Date(Date.now() - sinceDays * 86400000);
  let fetched = [];
  try {
    fetched = await fetchRecentMailboxMessages(config, 'INBOX', {
      sinceDate,
      maxMessages,
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'IMAP tarama hatası',
      scanned: 0,
      added: 0,
      autoreplies: [],
    };
  }

  const existing = await readMessages(dataDir);
  const byKey = new Map(existing.map((r) => [r.dedupeKey, r]));
  let added = 0;
  let refreshed = 0;
  const autoreplies = [];

  for (const msg of fetched) {
    const raw = msg.rawSource || msg.text || '';
    const parsed = parseMailBody(raw);
    const threadHdr = parseThreadHeadersFromRaw(raw);
    const dedupe = dedupeKey(msg);
    const prior = byKey.get(dedupe);
    if (prior) {
      const corrupt =
        prior.bodyText?.includes('\uFFFD')
        || prior.snippet?.includes('\uFFFD')
        || prior.bodyHtml?.includes('\uFFFD');
      const outlookTypo = /[\u00B9¹]/.test(prior.bodyText ?? '');
      const fixedText = repairUtf8Mojibake(parsed.text ?? '');
      const betterText =
        fixedText
        && !fixedText.includes('\uFFFD')
        && fixedText !== prior.bodyText
        && (corrupt || outlookTypo || turkishLetterScore(fixedText) > turkishLetterScore(prior.bodyText ?? ''));
      if (betterText) {
        prior.bodyText = fixedText;
        prior.bodyHtml = repairUtf8Mojibake(parsed.html ?? '');
        prior.snippet = repairUtf8Mojibake(parsed.snippet || prior.snippet || '');
        prior.subject = repairUtf8Mojibake(msg.subject ?? prior.subject);
        refreshed += 1;
      }
      await applyAutoreplyIfNeeded(dataDir, prior, autoreplies);
      continue;
    }

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
      source: 'imap',
      ingestedAt: new Date().toISOString(),
    };
    byKey.set(dedupe, row);
    added += 1;

    const { autoCreateCaseForInboxRow } = await import('./platformSupportCases.mjs');
    await autoCreateCaseForInboxRow(dataDir, row);

    await applyAutoreplyIfNeeded(dataDir, row, autoreplies);
  }

  const autoreplySent = autoreplies.some((a) => a.ok);
  if (added > 0 || refreshed > 0 || autoreplySent) {
    const merged = [...byKey.values()].sort(
      (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt),
    );
    await writeMessages(dataDir, merged);
  }

  return { ok: true, scanned: fetched.length, added, refreshed, autoreplies };
}

export async function syncPlatformSupportInbox(dataDir, { maxMessages = 40 } = {}) {
  const bridge = await importSupportInboxFromOutbox(dataDir, { limit: 120 });

  if (!isPlatformSupportImapConfigured()) {
    await ensureStore(dataDir);
    await writeFile(
      META_FILE(dataDir),
      JSON.stringify(
        { lastSyncAt: new Date().toISOString(), bridgeMode: true, added: bridge.added, scanned: bridge.scanned },
        null,
        2,
      ),
      'utf8',
    );
    return {
      ok: true,
      bridgeMode: true,
      scanned: bridge.scanned,
      added: bridge.added,
      autoreplies: [],
      message:
        bridge.added > 0
          ? `${bridge.added} mağaza gönderisi Destek gelen kutusuna alındı (outbox köprüsü)`
          : 'Mağaza outbox tarandı — yeni destek@ gönderisi yok. Gönderim hâlâ PENDING ise Posta → Gönderilen veya outbox işlemini kontrol edin.',
    };
  }
  const config = getPlatformSupportImapConfig();
  try {
    await verifyImapMailbox(config);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'IMAP bağlantı hatası' };
  }

  const imap = await importSupportInboxFromImap(dataDir, { maxMessages, sendAutoreply: true });
  if (!imap.ok) {
    return { ok: false, error: imap.error ?? 'IMAP içe aktarma başarısız' };
  }

  await ensureStore(dataDir);
  await writeFile(
    META_FILE(dataDir),
    JSON.stringify(
      {
        lastSyncAt: new Date().toISOString(),
        added: imap.added,
        scanned: imap.scanned,
        bridgeImported: bridge.added,
      },
      null,
      2,
    ),
    'utf8',
  );

  return {
    ok: true,
    scanned: imap.scanned,
    added: imap.added + bridge.added,
    bridgeImported: bridge.added,
    autoreplies: imap.autoreplies,
    message: `${imap.scanned} IMAP · ${imap.added} yeni · ${bridge.added} outbox köprüsü`,
  };
}

export async function listPlatformSupportInbox(dataDir, { limit = 50 } = {}) {
  await importSupportInboxFromOutbox(dataDir, { limit: 120 });
  await importSupportInboxFromImap(dataDir, { maxMessages: 30, sendAutoreply: true });
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
  const { text: replyText, html: replyHtml } = buildPlatformSupportOperatorReplyContent({
    body: text,
    operatorUsername,
  });
  const result = await sendSupportMail(dataDir, {
    to,
    subject,
    text: replyText,
    html: replyHtml,
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
