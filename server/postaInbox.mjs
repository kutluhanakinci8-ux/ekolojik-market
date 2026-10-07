import {
  buildImapClient,
  fetchRecentMailboxMessages,
  verifyImapMailbox,
} from './billEmailImap.mjs';
import { resolvePostaImapMailboxes } from './postaImapMailboxes.mjs';
import { applyImapMoveForFlags } from './postaImapActions.mjs';
import { listMergedRecentOutbox } from './emailOutbox.mjs';
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
import { groupIntoConversations, parseThreadHeadersFromRaw } from './postaConversation.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function applyPostaInboxFlags(dataDir, tenantId, id, patch) {
  const result = await patchPostaInboxFlags(dataDir, tenantId, id, patch);
  if (!result.ok || !String(id).startsWith('pi-')) return result;
  const move = await applyImapMoveForFlags(dataDir, tenantId, id, patch);
  if (!move.ok) return move;
  return { ...result, imapMove: move.skipped ? null : move };
}

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
    inReplyTo: row.inReplyTo ?? null,
    references: row.references ?? null,
    imapFolder: row.imapFolder ?? 'inbox',
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

async function ingestImapMessages(dataDir, tenantId, fetched, imapFolder) {
  const entries = [];
  for (const msg of fetched) {
    const raw = msg.rawSource || msg.text || '';
    const parsed = parseMailBody(raw);
    const attachments =
      imapFolder === 'inbox' || imapFolder === 'sent'
        ? await persistImapAttachments(dataDir, tenantId, raw)
        : [];
    const threadHdr = parseThreadHeadersFromRaw(raw);
    entries.push({
      imapUid: msg.imapUid,
      imapMailboxPath: msg.imapMailboxPath,
      imapFolder,
      messageId: msg.messageId,
      inReplyTo: threadHdr.inReplyTo,
      references: threadHdr.references,
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
  return savePostaImapBatch(dataDir, tenantId, entries);
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

  const client = buildImapClient(config);
  await client.connect();
  const mailboxes = await resolvePostaImapMailboxes(client);
  await client.logout();

  const sinceDate = new Date(Date.now() - 30 * 86400000);
  const jobs = [
    { imapFolder: 'inbox', path: mailboxes.inbox, max: maxMessages },
    { imapFolder: 'sent', path: mailboxes.sent, max: Math.min(maxMessages, 35) },
    { imapFolder: 'junk', path: mailboxes.junk, max: 25 },
    { imapFolder: 'trash', path: mailboxes.trash, max: 25 },
    { imapFolder: 'drafts', path: mailboxes.drafts, max: 20 },
  ].filter((j) => j.path);

  let scanned = 0;
  let added = 0;
  let updated = 0;
  const folderStats = {};

  for (const job of jobs) {
    let fetched = [];
    try {
      fetched = await fetchRecentMailboxMessages(config, job.path, {
        sinceDate,
        maxMessages: job.max,
      });
    } catch (error) {
      folderStats[job.imapFolder] = {
        error: error instanceof Error ? error.message : 'tarama hatası',
      };
      continue;
    }
    scanned += fetched.length;
    const saved = await ingestImapMessages(dataDir, tenantId, fetched, job.imapFolder);
    added += saved.added.length;
    updated += saved.updated?.length ?? 0;
    folderStats[job.imapFolder] = { scanned: fetched.length, added: saved.added.length };
  }

  return {
    ok: true,
    scanned,
    added,
    updated,
    folders: folderStats,
    mailboxes,
    message: `${scanned} mail tarandı · ${added} yeni · ${updated} güncellendi`,
  };
}

function imapFolderOf(item) {
  return String(item.imapFolder ?? item.raw?.imapFolder ?? 'inbox').toLowerCase();
}

function buildGelenPool(contacts, imap, billRows) {
  const matchedBillKeys = new Set(
    billRows.filter((b) => b.matched && !b.archived).map((b) => messageDedupeKey(b.raw)),
  );
  return [
    ...contacts.filter((i) => !i.archived),
    ...imap.filter((i) => !i.archived && imapFolderOf(i) === 'inbox'),
  ].filter((row) => {
    if (row.kind !== 'imap') return true;
    return !matchedBillKeys.has(messageDedupeKey(row.raw));
  });
}

function filterByMailboxFolder(items, folder) {
  const f = String(folder || 'gelen').toLowerCase();
  if (f === 'taslaklar') {
    return items.filter((i) => i.kind === 'imap' && imapFolderOf(i) === 'drafts');
  }
  if (f === 'cop') {
    return items.filter((i) => i.trashed || imapFolderOf(i) === 'trash');
  }
  if (f === 'spam') {
    return items.filter(
      (i) => (i.spam || imapFolderOf(i) === 'junk') && imapFolderOf(i) !== 'trash' && !i.trashed,
    );
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
    return items.filter(
      (i) =>
        !i.trashed &&
        !i.spam &&
        !i.archived &&
        !i.snoozeActive &&
        (i.kind !== 'imap' || imapFolderOf(i) === 'inbox'),
    );
  }
  // gelen (varsayılan)
  return items.filter(
    (i) =>
      !i.trashed &&
      !i.spam &&
      !i.archived &&
      !i.snoozeActive &&
      (i.kind !== 'imap' || imapFolderOf(i) === 'inbox'),
  );
}

function applyInboxListFilters(items, { q, unread, hasAttachment, starred } = {}) {
  let out = items;
  if (unread === true || unread === '1') out = out.filter((i) => i.unread);
  if (starred === true || starred === '1') out = out.filter((i) => i.starred);
  if (hasAttachment === true || hasAttachment === '1') {
    out = out.filter((i) => (i.attachments?.length ?? 0) > 0);
  }
  const needle = String(q ?? '').trim().toLowerCase();
  if (needle) {
    out = out.filter((i) =>
      [i.subject, i.preview, i.from, i.fromName, i.bodyText, i.to]
        .some((field) => String(field ?? '').toLowerCase().includes(needle)),
    );
  }
  return out;
}

export async function listUnifiedPostaInbox(
  dataDir,
  tenantId,
  { folder = 'gelen', limit = 60, q, unread, hasAttachment, starred, listMode } = {},
) {
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
  } else if (f === 'taslaklar') {
    base = imap.map(toUnifiedImap);
  } else if (f === 'cop' || f === 'spam' || f === 'yildizli' || f === 'ertelenen' || f === 'tumu') {
    base = [
      ...contacts,
      ...imap,
      ...billRows.filter((b) => b.matched || b.raw?.sourceId),
    ];
  } else {
    base = buildGelenPool(contacts, imap, billRows);
  }

  let items = filterByMailboxFolder(
    base.map((item) => applyPostaFlagsToItem(item, flagsMap)),
    folder,
  );

  items = applyInboxListFilters(items, { q, unread, hasAttachment, starred });
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

  const mode = String(listMode || 'message').toLowerCase();
  if (mode === 'conversation') {
    const conversations = groupIntoConversations(items).slice(0, max);
    return {
      ok: true,
      folder,
      listMode: 'conversation',
      items: conversations,
      imapConfigured: isEkolojikImapConfigured(),
    };
  }

  return {
    ok: true,
    folder,
    listMode: 'message',
    items: items.slice(0, max),
    imapConfigured: isEkolojikImapConfigured(),
  };
}

export async function searchUnifiedPostaInbox(dataDir, tenantId, options = {}) {
  return listUnifiedPostaInbox(dataDir, tenantId, options);
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

export async function listUnifiedPostaSent(dataDir, tenantId, { limit = 80 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 80, 1), 200);
  const outboxRows = await listMergedRecentOutbox(dataDir, max);
  const imapSent = (await listPostaImapMessages(dataDir, tenantId, { limit: max, imapFolder: 'sent' })).map(
    toUnifiedImap,
  );

  const outboxItems = outboxRows.map((row) => ({
    id: String(row.id ?? row.messageId ?? ''),
    kind: 'outbox',
    sourceId: String(row.id ?? ''),
    at: String(row.sentAt || row.createdAt || new Date().toISOString()),
    from: row.from ?? '',
    fromName: row.fromName ?? 'Ekolojik Market',
    to: row.to ?? '',
    subject: String(row.subject ?? '(konu yok)'),
    preview: String(row.text ?? row.subject ?? '').slice(0, 240),
    unread: false,
    archived: false,
    bodyText: String(row.text ?? ''),
    status: row.status ?? row.folder ?? 'sent',
    folder: row.folder ?? 'sent',
    lastError: row.lastError ?? null,
    raw: row,
  }));

  const merged = [...outboxItems, ...imapSent.map((i) => ({ ...i, kind: 'imap-sent', status: 'imap-sent' }))];
  merged.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return {
    ok: true,
    items: merged.slice(0, max),
    imapConfigured: isEkolojikImapConfigured(),
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
