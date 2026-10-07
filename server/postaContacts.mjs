import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readTenantStore, listContactMessages } from './tenantAuth.mjs';
import { listPostaImapMessages } from './postaInboxStore.mjs';
import { listMergedRecentOutbox } from './emailOutbox.mjs';

function contactsPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-contacts', tenantId, 'contacts.json');
}

async function readManualContacts(dataDir, tenantId) {
  try {
    const parsed = JSON.parse(await readFile(contactsPath(dataDir, tenantId), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.contacts ?? [];
  } catch {
    return [];
  }
}

async function writeManualContacts(dataDir, tenantId, rows) {
  await mkdir(join(dataDir, 'posta-contacts', tenantId), { recursive: true });
  await writeFile(contactsPath(dataDir, tenantId), JSON.stringify(rows.slice(0, 500), null, 2), 'utf8');
}

function extractEmail(raw) {
  const m = String(raw ?? '').match(/[\w.+-]+@[\w.-]+\.\w+/i);
  return m ? m[0].toLowerCase() : '';
}

function matchesQuery(row, q) {
  if (!q) return true;
  const hay = `${row.name} ${row.email} ${row.phone ?? ''} ${row.company ?? ''}`.toLowerCase();
  return hay.includes(q);
}

async function buildLastCorrespondenceMap(dataDir, tenantId) {
  const map = new Map();
  const touch = (email, at, subject) => {
    const e = extractEmail(email);
    if (!e || !at) return;
    const prev = map.get(e);
    if (!prev || Date.parse(at) > Date.parse(prev.at)) {
      map.set(e, { at, subject: subject ?? '' });
    }
  };

  for (const row of await listPostaImapMessages(dataDir, tenantId, { limit: 150 })) {
    const at = row.receivedAt || row.ingestedAt;
    touch(row.from, at, row.subject);
    touch(row.to, at, row.subject);
  }
  for (const row of await listMergedRecentOutbox(dataDir, 80)) {
    touch(row.to, row.sentAt || row.createdAt, row.subject);
  }
  for (const c of await listContactMessages(dataDir, 80)) {
    touch(c.email, c.createdAt, c.subject ?? 'İletişim formu');
  }
  return map;
}

export async function listPostaContacts(dataDir, tenantId = 'main', { q = '', limit = 120 } = {}) {
  const query = String(q).trim().toLowerCase();
  const max = Math.min(Math.max(Number(limit) || 120, 1), 300);
  const manual = await readManualContacts(dataDir, tenantId);
  const store = await readTenantStore(dataDir, tenantId);
  const lastMap = await buildLastCorrespondenceMap(dataDir, tenantId);

  const byEmail = new Map();

  for (const c of store?.customers ?? []) {
    const email = extractEmail(c.email);
    if (!email) continue;
    byEmail.set(email, {
      id: `customer-${c.id}`,
      email,
      name: String(c.name ?? c.email).trim(),
      phone: c.phone ?? null,
      company: c.company ?? null,
      source: 'customer',
      customerId: c.id,
      notes: null,
      manual: false,
    });
  }

  for (const row of manual) {
    const email = extractEmail(row.email);
    if (!email) continue;
    byEmail.set(email, {
      id: row.id || `manual-${randomUUID()}`,
      email,
      name: String(row.name ?? email).trim(),
      phone: row.phone ?? null,
      company: row.company ?? null,
      source: 'manual',
      customerId: row.customerId ?? null,
      notes: row.notes ?? null,
      manual: true,
    });
  }

  for (const row of await listPostaImapMessages(dataDir, tenantId, { limit: 60 })) {
    const email = extractEmail(row.from);
    if (!email || byEmail.has(email)) continue;
    byEmail.set(email, {
      id: `suggested-${email}`,
      email,
      name: String(row.fromName ?? row.from ?? email).trim(),
      phone: null,
      company: null,
      source: 'suggested',
      customerId: null,
      notes: 'Gelen kutusundan öneri',
      manual: false,
    });
  }

  const contacts = [...byEmail.values()]
    .map((row) => {
      const last = lastMap.get(row.email);
      return {
        ...row,
        lastCorrespondenceAt: last?.at ?? null,
        lastSubject: last?.subject ?? null,
      };
    })
    .filter((row) => matchesQuery(row, query))
    .sort((a, b) => {
      const ta = Date.parse(a.lastCorrespondenceAt || 0);
      const tb = Date.parse(b.lastCorrespondenceAt || 0);
      if (tb !== ta) return tb - ta;
      return a.name.localeCompare(b.name, 'tr');
    })
    .slice(0, max);

  return { ok: true, contacts };
}

export async function upsertPostaContact(dataDir, tenantId, payload) {
  const email = extractEmail(payload?.email);
  const name = String(payload?.name ?? '').trim();
  if (!email) return { ok: false, error: 'Geçerli e-posta gerekli' };
  if (!name) return { ok: false, error: 'Ad gerekli' };

  const rows = await readManualContacts(dataDir, tenantId);
  const id = payload.id ? String(payload.id) : `pc-${randomUUID()}`;
  const row = {
    id,
    email,
    name,
    phone: payload.phone ? String(payload.phone).trim() : null,
    company: payload.company ? String(payload.company).trim() : null,
    customerId: payload.customerId ?? null,
    notes: payload.notes ? String(payload.notes).trim() : null,
    updatedAt: new Date().toISOString(),
  };
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
  else rows.unshift(row);
  await writeManualContacts(dataDir, tenantId, rows);
  return { ok: true, contact: { ...row, source: 'manual', manual: true } };
}

export async function deletePostaContact(dataDir, tenantId, id) {
  const rows = await readManualContacts(dataDir, tenantId);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return { ok: false, error: 'Kişi bulunamadı (yalnızca manuel kayıtlar silinir)' };
  await writeManualContacts(dataDir, tenantId, next);
  return { ok: true };
}

export function contactsToVcard(contacts) {
  return contacts
    .map((c) => {
      const card = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVcard(c.name)}`, `EMAIL:${c.email}`];
      if (c.phone) card.push(`TEL:${escapeVcard(c.phone)}`);
      if (c.company) card.push(`ORG:${escapeVcard(c.company)}`);
      card.push('END:VCARD');
      return card.join('\r\n');
    })
    .join('\r\n');
}

function escapeVcard(value) {
  return String(value ?? '').replace(/[\\;,\n]/g, (ch) => (ch === '\n' ? '\\n' : `\\${ch}`));
}

export function parseVcardImport(text) {
  const blocks = String(text).split(/END:VCARD/i);
  const imported = [];
  for (const block of blocks) {
    const email = block.match(/^EMAIL[^:]*:(.+)$/im)?.[1]?.trim();
    const name = block.match(/^FN:(.+)$/im)?.[1]?.trim() || email;
    if (email?.includes('@')) {
      imported.push({ name: name.replace(/\\n/g, ' '), email });
    }
  }
  return imported;
}

export function parseCsvContactsImport(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = header.includes('email') || header.includes('e-posta');
  const start = hasHeader ? 1 : 0;
  const imported = [];
  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    const email = cols.find((c) => c.includes('@')) ?? cols[1];
    const name = cols[0] || email;
    if (email?.includes('@')) imported.push({ name, email });
  }
  return imported;
}

export async function importPostaContacts(dataDir, tenantId, rows) {
  let count = 0;
  for (const row of rows) {
    const res = await upsertPostaContact(dataDir, tenantId, row);
    if (res.ok) count += 1;
  }
  return { ok: true, imported: count };
}
