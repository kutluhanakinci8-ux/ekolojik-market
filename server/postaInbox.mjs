import { fetchRecentInboxMessages, verifyImapMailbox } from './billEmailImap.mjs';
import { parseMailBody } from './mailBodyParse.mjs';
import { listBillEmailInbox, messageDedupeKey } from './billEmailInboxStore.mjs';
import {
  listPostaImapMessages,
  savePostaImapBatch,
  updatePostaImapMessage,
} from './postaInboxStore.mjs';
import { listContactMessages, markContactMessageRead, archiveContactMessage } from './tenantAuth.mjs';
import { getEkolojikImapConfig, isEkolojikImapConfigured } from './ekolojikMailConfig.mjs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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

function isUnread(row) {
  return !row.readAt;
}

function toUnifiedContact(row) {
  return {
    id: `contact-${row.id}`,
    kind: 'contact',
    sourceId: row.id,
    at: row.createdAt,
    from: row.email,
    fromName: row.name,
    to: null,
    subject: subjectLabel(row.subject),
    preview: row.message,
    unread: isUnread(row),
    archived: Boolean(row.archivedAt),
    bodyText: [
      `Ad: ${row.name}`,
      `E-posta: ${row.email}`,
      row.phone ? `Telefon: ${row.phone}` : null,
      `Konu: ${subjectLabel(row.subject)}`,
      '',
      row.message,
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
    bodyText: row.snippet || '',
    bodyHtml: '',
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

  const entries = fetched.map((msg) => {
    const parsed = parseMailBody(msg.text);
    return {
      imapUid: msg.imapUid,
      messageId: msg.messageId,
      from: msg.from,
      to: msg.to,
      subject: msg.subject,
      receivedAt: msg.receivedAt,
      snippet: parsed.snippet || msg.snippet,
      bodyText: parsed.text,
      bodyHtml: parsed.html,
    };
  });

  const saved = await savePostaImapBatch(dataDir, tenantId, entries);
  return {
    ok: true,
    scanned: fetched.length,
    added: saved.added.length,
    total: saved.total,
    message: `${fetched.length} mail tarandı · ${saved.added.length} yeni`,
  };
}

export async function listUnifiedPostaInbox(dataDir, tenantId, { folder = 'gelen', limit = 60 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 60, 1), 200);
  const contacts = (await listContactMessages(dataDir, 200)).map(toUnifiedContact);
  const imap = (await listPostaImapMessages(dataDir, tenantId, { limit: 200 })).map(toUnifiedImap);
  const billResult = await listBillEmailInbox(dataDir, tenantId, { limit: 200 });
  const billRows = (billResult.messages ?? []).map((row) => {
    const withFlags = { ...row, readAt: row.readAt ?? null, archivedAt: row.archivedAt ?? null };
    return toUnifiedBill(withFlags);
  });

  let items = [];
  if (folder === 'fatura') {
    items = billRows.filter((b) => !b.archived && (b.matched || b.raw?.sourceId));
  } else if (folder === 'arsiv') {
    items = [...contacts, ...imap, ...billRows].filter((i) => i.archived);
  } else {
    const matchedBillKeys = new Set(
      billRows.filter((b) => b.matched && !b.archived).map((b) => messageDedupeKey(b.raw)),
    );
    items = [
      ...contacts.filter((i) => !i.archived),
      ...imap.filter((i) => !i.archived),
    ].filter((row) => {
      if (row.kind !== 'imap') return true;
      return !matchedBillKeys.has(messageDedupeKey(row.raw));
    });
  }

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
  return {
    ok: true,
    gelen: gelenUnread,
    fatura: faturaUnread,
    total: gelenUnread + faturaUnread,
  };
}
