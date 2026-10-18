import { listPostaCalendar, upsertPostaCalendarEvent, deletePostaCalendarEvent } from './postaCalendar.mjs';

export function getPostaCalDavLitePrincipal() {
  return {
    ok: true,
    version: 2,
    note: 'ICS abonelik + REST iki yön köprüsü; tam CalDAV sunucu değil',
    calendarHome: '/api/posta/caldav-lite/events',
    supported: ['VEVENT'],
    readOnly: false,
    methods: ['GET', 'POST', 'DELETE'],
    icsSubscribePath: '/api/posta/calendar/feed.ics',
    icsExportPath: '/api/posta/calendar/export.ics',
  };
}

export async function getPostaCalDavLiteEvent(dataDir, tenantId, eventId) {
  const listed = await listPostaCalDavLiteEvents(dataDir, tenantId);
  if (!listed.ok) return listed;
  const hit = (listed.events ?? []).find((e) => e.uid === eventId);
  if (!hit) return { ok: false, error: 'Etkinlik bulunamadı' };
  return { ok: true, event: hit };
}

export async function listPostaCalDavLiteEvents(dataDir, tenantId) {
  const cal = await listPostaCalendar(dataDir, tenantId);
  if (!cal.ok) return cal;
  return {
    ok: true,
    events: (cal.events ?? []).map((e) => ({
      uid: e.id,
      summary: e.title,
      dtstart: e.startAt,
      dtend: e.endAt,
      description: e.notes ?? '',
      href: `/api/posta/caldav-lite/events/${encodeURIComponent(e.id)}`,
    })),
  };
}

export async function upsertPostaCalDavLiteEvent(dataDir, tenantId, payload) {
  return upsertPostaCalendarEvent(dataDir, tenantId, {
    id: payload.id ?? payload.uid,
    title: payload.summary ?? payload.title,
    startAt: payload.dtstart ?? payload.startAt,
    endAt: payload.dtend ?? payload.endAt,
    notes: payload.description ?? payload.notes,
  });
}

export async function deletePostaCalDavLiteEvent(dataDir, tenantId, eventId) {
  return deletePostaCalendarEvent(dataDir, tenantId, eventId);
}
