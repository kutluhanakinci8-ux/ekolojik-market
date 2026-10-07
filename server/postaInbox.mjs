import { fetchRecentInboxMessages, verifyImapMailbox } from './billEmailImap.mjs';
import { parseMailBody } from './mailBodyParse.mjs';
import { listBillEmailInbox, messageDedupeKey } from './billEmailInboxStore.mjs';
import {
  listPostaImapMessages,
  savePostaImapBatch,
  updatePostaImapMessage,
  findPostaImapMessage,
} from './postaInboxStore.mjs';
import { listContactMessages, markContactMessageRead, archiveContactMessage } from './tenantAuth.mjs';
import { getEkolojikImapConfig, isEkolojikImapConfigured } from './ekolojikMailConfig.mjs';
import { countStaffUnreadMessagingThreads } from './messaging/store.mjs';
import { persistImapAttachments, readPostaInboxAttachment } from './postaInboxAttachments.mjs';
import { applyPostaFlagsToItem, getPostaInboxFlagsMap, patchPostaInboxFlags } from './postaInboxFlags.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export { patchPostaInboxFlags };

const SUBJECT_LABELS = {
  genel: 'Genel',
  siparis: 'Sipariş',
  bayi: 'Bayi / Toptan',
  sikayet: 'Şikayet',
  diger: 'Diğer',
};

function subjectLabel(code) {
  const key = String(code ?? 'genel').trim().toLowerCase();
  return SUBJECT_LABELS[key] ?? code ?? 'Genel';
}

/** UTF-8 metin yanlışlıkla latin1 okunduysa (MÃ¼Återi) düzelt. */
function repairUtf8Mojibake(str) {
  const s = String(str ?? '');
  if (!s || !/[ÃÄÅÆØ]/.test(s)) return s;
  try {
    const fixed = Buffer.from(s, 'latin1').toString('utf8');
    if (fixed !== s && !/[ÃÄÅÆØ]/.test(fixed)) return fixed;
    return s;
  } catch {
    return s;
  }
}

function isUnread(row) {
  return !row.readAt;
}

function toUnifiedContact(row) {
  const name = repairUtf8Mojibake(row.name);
  const message = repairUtf8Mojibake(row.message);
  return {
    id: `contact-${row.id}`,
    kind: 'contact',
    sourceId: row.id,
    at: row.createdAt,
    from: row.email,
    fromName: name,
    to: null,
    subject: subjectLabel(row.subject),
    preview: message,
    unread: isUnread(row),
    archived: Boolean(row.archivedAt),
    bodyText: [
      `Ad: ${name}`,
      `E-posta: ${row.email}`,
      row.phone ? `Telefon: ${row.phone}` : null,
      `Konu: ${subjectLabel(row.subject)}`,
      '',
      message,
    ]
      .filter(Boolean)
      .join('\n'),
    bodyHtml: '',
    raw: row,
  };
}

function toUnifiedImap(row) {
  return {
    id: row.id,
    kind: 'imap',
    sourceId: row.id,
    at: row.receivedAt,
    from: row.from,
    fromName: row.from,
    to: row.to,
    subject: row.subject || '(konu yok)',
    preview: row.snippet || row.bodyText?.slice(0, 240) || '',
    unread: isUnread(row),
    archived: Boolean(row.archivedAt),
    bodyText: row.bodyText ?? '',
    bodyHtml: row.bodyHtml ?? '',
    messageId: row.messageId ?? null,
    attachments: row.attachments ?? [],
    raw: row,
  };
}

function toUnifiedBill(row) {
  return {
    id: row.id,
    kind: 'bill',
    sourceId: row.id,
    at: row.receivedAt,
    from: row.from,
    fromName: row.sourceLabel || row.from,
    to: row.to,
    subject: row.subject || 'Fatura e-postası',
    preview: row.snippet || '',
    unread: isUnread(row),
    archived: Boolean(row.archivedAt),
    bodyText: row.bodyText || row.snippet || '',
    bodyHtml: row.bodyHtml ?? '',
    amount: row.amount,
    dueDate: row.dueDate,
    matched: row.matched,
    raw: row,
  };
}

async function readBillIndex(dataDir, tenantId) {
  const path = join(dataDir, 'bill-email-inbox', tenantId, 'messages.json');
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.messages ?? [];
  } catch {
    return [];
  }
}

async function writeBillIndex(dataDir, tenantId, rows) {
  const path = join(dataDir, 'bill-email-inbox', tenantId, 'messages.json');
  await writeFile(path, JSON.stringify(rows.slice(0, 500), null, 2), 'utf8');
}

export async function syncPostaInboxFromImap(dataDir, tenantId = 'main', { maxMessages = 40 } = {}) {
  if (!isEkolojikImapConfigured()) {
    return { ok: false, error: 'IMAP yapılandırılmadı (EKOLOJIK_IMAP_*)' };
  }
  const config = getEkolojikImapConfig();
  try {
    await verifyImapMailbox(config);
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'IMAP bağlantı hatası',
    };
  }

  const sinceDate = new Date(Date.now() - 30 * 86400000);
  let fetched = [];
  try {
    fetched = await fetchRecentInboxMessages(config, { sinceDate, maxMessages });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'IMAP tarama hatası' };
  }

  const entries = [];
  for (const msg of fetched) {
    const raw = msg.rawSource || msg.text || '';
    const parsed = parseMailBody(raw);
    const attachments = await persistImapAttachments(dataDir, tenantId, raw);
    entries.push({
      imapUid: msg.imapUid,
      messageId: msg.messageId,
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      receivedAt: msg.receivedAt,
      snippet: parsed.snippet || msg.snippet,
      bodyText: parsed.text,
      bodyHtml: parsed.html,
      attachments,
    });
  }

  const saved = await savePostaImapBatch(dataDir, tenantId, entries);
  return {
    ok: true,
    scanned: fetched.length,
    added: saved.added.length,
    total: saved.total,
    message: `${fetched.length} mail tarandı · ${saved.added.length} yeni`,
  };
}

function buildGelenPool(contacts, imap, billRows) {
  const matchedBillKeys = new Set(
    billRows.filter((b) => b.matched && !b.archived).map((b) => messageDedupeKey(b.raw)),
  );
  return [
    ...contacts.filter((i) => !i.archived),
    ...imap.filter((i) => !i.archived),
  ].filter((row) => {
    if (row.kind !== 'imap') return true;
    return !matchedBillKeys.has(messageDedupeKey(row.raw));
  });
}

function filterByMailboxFolder(items, folder) {
  const f = String(folder || 'gelen').toLowerCase();
  if (f === 'cop') {
    return items.filter((i) => i.trashed);
  }
  if (f === 'spam') {
    return items.filter((i) => i.spam && !i.trashed);
  }
  if (f === 'arsiv') {
    return items.filter((i) => i.archived && !i.trashed && !i.spam);
  }
  if (f === 'yildizli') {
    return items.filter((i) => i.starred && !i.trashed && !i.spam);
  }
  if (f === 'ertelenen') {
    return items.filter((i) => i.snoozeActive && !i.trashed && !i.spam);
  }
  if (f === 'fatura') {
    return items.filter((i) => i.kind === 'bill' && !i.archived && !i.trashed && !i.spam);
  }
  if (f === 'tumu') {
    return items.filter((i) => !i.trashed && !i.spam && !i.archived && !i.snoozeActive);
  }
  // gelen (varsayılan)
  return items.filter((i) => !i.trashed && !i.spam && !i.archived && !i.snoozeActive);
}

export async function listUnifiedPostaInbox(dataDir, tenantId, { folder = 'gelen', limit = 60 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 60, 1), 200);
  const flagsMap = await getPostaInboxFlagsMap(dataDir, tenantId);
  const contacts = (await listContactMessages(dataDir, 200)).map(toUnifiedContact);
  const imap = (await listPostaImapMessages(dataDir, tenantId, { limit: 200 })).map(toUnifiedImap);
  const billResult = await listBillEmailInbox(dataDir, tenantId, { limit: 200 });
  const billRows = (billResult.messages ?? []).map((row) => {
    const withFlags = { ...row, readAt: row.readAt ?? null, archivedAt: row.archivedAt ?? null };
    return toUnifiedBill(withFlags);
  });

  let base = [];
  const f = String(folder || 'gelen').toLowerCase();
  if (f === 'fatura') {
    base = billRows.filter((b) => b.matched || b.raw?.sourceId);
  } else if (f === 'arsiv') {
    base = [...contacts, ...imap, ...billRows].filter((i) => i.archived);
  } else if (f === 'cop' || f === 'spam' || f === 'yildizli' || f === 'ertelenen' || f === 'tumu') {
    base = [
      ...contacts,
      ...imap,
      ...billRows.filter((b) => b.matched || b.raw?.sourceId),
    ];
  } else {
    base = buildGelenPool(contacts, imap, billRows);
  }

  const items = filterByMailboxFolder(
    base.map((item) => applyPostaFlagsToItem(item, flagsMap)),
    folder,
  );

  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { ok: true, folder, items: items.slice(0, max), imapConfigured: isEkolojikImapConfigured() };
}

export async function markPostaInboxRead(dataDir, tenantId, { id, kind, sourceId }) {
  const key = String(sourceId || id || '').replace(/^(contact|bill|pi)-/, '');
  if (kind === 'contact' || String(id).startsWith('contact-')) {
    const contactId = String(id).replace(/^contact-/, '') || key;
    return markContactMessageRead(dataDir, contactId);
  }
  if (kind === 'bill' || String(id).startsWith('be-')) {
    const rows = await readBillIndex(dataDir, tenantId);
    const idx = rows.findIndex((r) => r.id === id || r.id === sourceId);
    if (idx < 0) return { ok: false, error: 'Fatura kaydı bulunamadı' };
    rows[idx].readAt = new Date().toISOString();
    await writeBillIndex(dataDir, tenantId, rows);
    return { ok: true };
  }
  const imapId = id?.startsWith('pi-') ? id : sourceId;
  return updatePostaImapMessage(dataDir, tenantId, imapId, { readAt: new Date().toISOString() });
}

export async function archivePostaInboxItem(dataDir, tenantId, { id, kind, sourceId }) {
  if (kind === 'contact' || String(id).startsWith('contact-')) {
    const contactId = String(id).replace(/^contact-/, '') || sourceId;
    return archiveContactMessage(dataDir, contactId);
  }
  if (kind === 'bill' || String(id).startsWith('be-')) {
    const rows = await readBillIndex(dataDir, tenantId);
    const idx = rows.findIndex((r) => r.id === id || r.id === sourceId);
    if (idx < 0) return { ok: false, error: 'Fatura kaydı bulunamadı' };
    rows[idx].archivedAt = new Date().toISOString();
    await writeBillIndex(dataDir, tenantId, rows);
    return { ok: true };
  }
  return updatePostaImapMessage(dataDir, tenantId, id || sourceId, {
    archivedAt: new Date().toISOString(),
  });
}

export async function getComposeRecipientHints(dataDir, { limit = 40 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 40, 1), 100);
  const emails = new Set();
  for (const c of await listContactMessages(dataDir, 100)) {
    const e = String(c.email ?? '').trim().toLowerCase();
    if (e.includes('@')) emails.add(e);
  }
  for (const row of await listPostaImapMessages(dataDir, 'main', { limit: 80 })) {
    const match = String(row.from ?? '').match(/[\w.+-]+@[\w.-]+\.\w+/i);
    if (match) emails.add(match[0].toLowerCase());
  }
  return { ok: true, emails: [...emails].slice(0, max) };
}

export async function getPostaUnreadCounts(dataDir, tenantId = 'main') {
  const inbox = await listUnifiedPostaInbox(dataDir, tenantId, { folder: 'gelen', limit: 200 });
  const fatura = await listUnifiedPostaInbox(dataDir, tenantId, { folder: 'fatura', limit: 200 });
  const gelenUnread = inbox.items.filter((i) => i.unread).length;
  const faturaUnread = fatura.items.filter((i) => i.unread).length;
  const messagingUnread = await countStaffUnreadMessagingThreads(dataDir, tenantId);
  return {
    ok: true,
    gelen: gelenUnread,
    fatura: faturaUnread,
    messaging: messagingUnread,
    total: gelenUnread + faturaUnread + messagingUnread,
  };
}

export async function loadPostaInboxAttachment(dataDir, tenantId, inboxId, attachmentId) {
  const row = await findPostaImapMessage(dataDir, tenantId, inboxId);
  const meta = row?.attachments?.find((a) => a.id === attachmentId);
  if (!meta) return { ok: false, error: 'Ek bulunamadı' };
  try {
    const data = await readPostaInboxAttachment(dataDir, tenantId, attachmentId);
    return { ok: true, meta, data };
  } catch {
    return { ok: false, error: 'Ek dosyası okunamadı' };
  }
}
