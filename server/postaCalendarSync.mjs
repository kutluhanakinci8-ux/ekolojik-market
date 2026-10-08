import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { listPostaCalendar } from './postaCalendar.mjs';

function tokenPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'posta-calendar', tenantId, 'ics-feed-token.json');
}

function escapeIcsText(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function formatIcsUtc(dateIso) {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function buildPostaCalendarIcs(events, { calendarName = 'Ekolojik Posta' } = {}) {
  const now = formatIcsUtc(new Date().toISOString());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Ekolojik Market//Posta Calendar//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (const ev of events) {
    const uid = `${String(ev.id).replace(/[^a-zA-Z0-9_-]/g, '_')}@ekolojik-posta`;
    const stamp = now ?? formatIcsUtc(ev.at) ?? '19700101T000000Z';
    const dateOnly = String(ev.date ?? ev.at ?? '').slice(0, 10);
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
      lines.push(`DTSTART;VALUE=DATE:${dateOnly.replace(/-/g, '')}`);
    } else {
      const start = formatIcsUtc(ev.at);
      if (start) lines.push(`DTSTART:${start}`);
    }
    lines.push(`SUMMARY:${escapeIcsText(ev.title)}`);
    if (ev.notes) lines.push(`DESCRIPTION:${escapeIcsText(ev.notes)}`);
    if (ev.kind) lines.push(`CATEGORIES:${escapeIcsText(ev.kind)}`);
    if (ev.amount != null) lines.push(`X-EKOLOJIK-AMOUNT:${ev.amount}`);
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');
  return `${lines.join('\r\n')}\r\n`;
}

async function readFeedToken(dataDir, tenantId) {
  try {
    const raw = JSON.parse(await readFile(tokenPath(dataDir, tenantId), 'utf8'));
    if (raw?.token) return raw;
  } catch {
    /* create */
  }
  return null;
}

export async function getOrCreatePostaCalendarFeedToken(dataDir, tenantId = 'main') {
  const existing = await readFeedToken(dataDir, tenantId);
  if (existing?.token) return existing;
  const row = {
    token: randomBytes(24).toString('hex'),
    createdAt: new Date().toISOString(),
  };
  await mkdir(join(dataDir, 'posta-calendar', tenantId), { recursive: true });
  await writeFile(tokenPath(dataDir, tenantId), JSON.stringify(row, null, 2), 'utf8');
  return row;
}

export async function rotatePostaCalendarFeedToken(dataDir, tenantId = 'main') {
  const row = {
    token: randomBytes(24).toString('hex'),
    createdAt: new Date().toISOString(),
  };
  await mkdir(join(dataDir, 'posta-calendar', tenantId), { recursive: true });
  await writeFile(tokenPath(dataDir, tenantId), JSON.stringify(row, null, 2), 'utf8');
  return { ok: true, token: row.token, createdAt: row.createdAt };
}

export async function validatePostaCalendarFeedToken(dataDir, tenantId, token) {
  const saved = await readFeedToken(dataDir, tenantId);
  return Boolean(saved?.token && token && saved.token === token);
}

export function resolvePostaPublicBaseUrl(req) {
  const env =
    process.env.EKOLOJIK_PUBLIC_URL?.trim() ||
    process.env.EKOLOJIK_MAIL_TRACK_BASE_URL?.trim() ||
    '';
  if (env) return env.replace(/\/$/, '');
  const host = req.headers.host;
  if (!host) return `http://127.0.0.1:${process.env.PORT || 5180}`;
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${host}`;
}

export async function getPostaCalendarSyncHub(dataDir, tenantId, publicBaseUrl) {
  const feed = await getOrCreatePostaCalendarFeedToken(dataDir, tenantId);
  const base = String(publicBaseUrl ?? '').replace(/\/$/, '');
  const tenantQs = tenantId && tenantId !== 'main' ? `&tenant=${encodeURIComponent(tenantId)}` : '';
  const feedPath = `/api/posta/calendar/feed.ics?token=${encodeURIComponent(feed.token)}${tenantQs}`;
  const feedUrl = `${base}${feedPath}`;
  const webcalUrl = feedUrl.replace(/^https?:/i, 'webcal:');

  return {
    ok: true,
    mode: 'ics-subscribe',
    caldav: {
      supported: true,
      mode: 'lite-rest',
      principalPath: '/api/posta/caldav-lite/principal',
      eventsPath: '/api/posta/caldav-lite/events',
      note: 'İki yön: hub takvim + CalDAV lite REST; harici uygulama için ICS abonelik.',
    },
    carddav: {
      supported: true,
      mode: 'lite-vcard',
      principalPath: '/api/posta/carddav-lite/principal',
      vcardExportPath: '/api/posta/contacts/export.vcf',
      vcardExportUrl: `${base}/api/posta/contacts/export.vcf?tenant=${encodeURIComponent(tenantId)}`,
      vcardImportPath: '/api/posta/contacts/import',
    },
    ics: {
      exportPath: '/api/posta/calendar/export.ics',
      exportUrl: `${base}/api/posta/calendar/export.ics`,
      subscribePath: feedPath,
      subscribeUrl: feedUrl,
      webcalUrl,
      tokenRotatedAt: feed.createdAt,
    },
    refreshHint: 'Harici takvim uygulamasında abonelik genelde 15–60 dk aralıkla yenilenir.',
  };
}

export async function buildPostaCalendarIcsFeed(dataDir, tenantId = 'main', { limit = 200 } = {}) {
  const listed = await listPostaCalendar(dataDir, tenantId, { limit });
  const ics = buildPostaCalendarIcs(listed.events ?? []);
  return { ok: true, ics, eventCount: listed.events?.length ?? 0 };
}
