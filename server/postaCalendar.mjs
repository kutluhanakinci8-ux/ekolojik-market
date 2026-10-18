import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readTenantStore } from './tenantAuth.mjs';
import { getPostaInboxFlagsMap } from './postaInboxFlags.mjs';
import { listPostaImapMessages } from './postaInboxStore.mjs';
import { listUnifiedPostaInbox } from './postaInbox.mjs';

function eventsPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-calendar', tenantId, 'events.json');
}

function paymentSnapshotPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-calendar', tenantId, 'payment-reminders.json');
}

export async function syncPaymentRemindersSnapshot(dataDir, tenantId, reminders) {
  const rows = Array.isArray(reminders) ? reminders : [];
  await mkdir(join(dataDir, 'posta-calendar', tenantId), { recursive: true });
  await writeFile(paymentSnapshotPath(dataDir, tenantId), JSON.stringify(rows.slice(0, 200), null, 2), 'utf8');
  return { ok: true, count: rows.length };
}

async function readPaymentReminders(dataDir, tenantId) {
  try {
    const snap = JSON.parse(await readFile(paymentSnapshotPath(dataDir, tenantId), 'utf8'));
    if (Array.isArray(snap) && snap.length) return snap;
  } catch {
    /* fallback store */
  }
  const store = await readTenantStore(dataDir, tenantId);
  return store?.settings?.paymentReminders ?? [];
}

async function readManualEvents(dataDir, tenantId) {
  try {
    const parsed = JSON.parse(await readFile(eventsPath(dataDir, tenantId), 'utf8'));
    return Array.isArray(parsed) ? parsed : parsed.events ?? [];
  } catch {
    return [];
  }
}

async function writeManualEvents(dataDir, tenantId, rows) {
  await mkdir(join(dataDir, 'posta-calendar', tenantId), { recursive: true });
  await writeFile(eventsPath(dataDir, tenantId), JSON.stringify(rows.slice(0, 300), null, 2), 'utf8');
}

export async function listPostaCalendar(dataDir, tenantId = 'main', { limit = 120 } = {}) {
  const max = Math.min(Math.max(Number(limit) || 120, 1), 300);
  const manual = await readManualEvents(dataDir, tenantId);
  const flags = await getPostaInboxFlagsMap(dataDir, tenantId);

  const events = [];

  for (const r of await readPaymentReminders(dataDir, tenantId)) {
    if (!r?.dueDate) continue;
    events.push({
      id: `payment-${r.id}`,
      kind: 'payment',
      title: r.title ?? 'Ödeme hatırlatması',
      date: String(r.dueDate).slice(0, 10),
      at: `${String(r.dueDate).slice(0, 10)}T09:00:00.000Z`,
      amount: r.amount ?? null,
      notes: r.notes ?? null,
      source: 'pos',
      editable: false,
    });
  }

  for (const row of manual) {
    events.push({
      id: row.id,
      kind: row.kind ?? 'manual',
      title: row.title,
      date: row.date,
      at: row.at ?? `${row.date}T10:00:00.000Z`,
      notes: row.notes ?? null,
      mailId: row.mailId ?? null,
      source: 'manual',
      editable: true,
    });
  }

  const inbox = await listUnifiedPostaInbox(dataDir, tenantId, { folder: 'ertelenen', limit: 80 });
  for (const item of inbox.items) {
    if (!item.snoozedUntil) continue;
    const until = String(item.snoozedUntil);
    events.push({
      id: `snooze-${item.id}`,
      kind: 'snooze',
      title: `E-posta geri dönüş: ${item.subject}`,
      date: until.slice(0, 10),
      at: until,
      notes: item.preview?.slice(0, 120) ?? null,
      mailId: item.id,
      source: 'inbox',
      editable: false,
    });
  }

  for (const [id, f] of Object.entries(flags)) {
    if (!f?.snoozedUntil || Date.parse(f.snoozedUntil) <= Date.now()) continue;
    if (events.some((e) => e.id === `snooze-${id}`)) continue;
    const imap = (await listPostaImapMessages(dataDir, tenantId, { limit: 200 })).find(
      (m) => m.id === id || `pi-${m.id}` === id,
    );
    events.push({
      id: `snooze-${id}`,
      kind: 'snooze',
      title: `E-posta geri dönüş: ${imap?.subject ?? id}`,
      date: String(f.snoozedUntil).slice(0, 10),
      at: f.snoozedUntil,
      notes: imap?.preview ?? null,
      mailId: id,
      source: 'inbox',
      editable: false,
    });
  }

  events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return { ok: true, events: events.slice(0, max) };
}

export async function upsertPostaCalendarEvent(dataDir, tenantId, payload) {
  const title = String(payload?.title ?? '').trim();
  const date = String(payload?.date ?? '').slice(0, 10);
  if (!title) return { ok: false, error: 'Başlık gerekli' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: 'Geçerli tarih (YYYY-MM-DD) gerekli' };

  const rows = await readManualEvents(dataDir, tenantId);
  const id = payload.id ? String(payload.id) : `cal-${randomUUID()}`;
  const row = {
    id,
    kind: payload.kind ?? 'manual',
    title,
    date,
    at: payload.at ?? `${date}T10:00:00.000Z`,
    notes: payload.notes ? String(payload.notes).trim() : null,
    mailId: payload.mailId ?? null,
    updatedAt: new Date().toISOString(),
  };
  const idx = rows.findIndex((r) => r.id === id);
  if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
  else rows.unshift(row);
  await writeManualEvents(dataDir, tenantId, rows);
  return { ok: true, event: row };
}

export async function deletePostaCalendarEvent(dataDir, tenantId, id) {
  const rows = await readManualEvents(dataDir, tenantId);
  const next = rows.filter((r) => r.id !== id);
  if (next.length === rows.length) return { ok: false, error: 'Etkinlik bulunamadı' };
  await writeManualEvents(dataDir, tenantId, next);
  return { ok: true };
}

export async function createCalendarEventFromMail(dataDir, tenantId, { mailId, subject, date, notes }) {
  const title = String(subject ?? 'E-posta takibi').trim();
  const eventDate = date ? String(date).slice(0, 10) : new Date().toISOString().slice(0, 10);
  return upsertPostaCalendarEvent(dataDir, tenantId, {
    kind: 'mail',
    title,
    date: eventDate,
    notes: notes ?? `Posta: ${mailId}`,
    mailId,
  });
}
