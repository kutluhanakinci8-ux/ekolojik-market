import { listPostaCalendar, upsertPostaCalendarEvent, deletePostaCalendarEvent } from './postaCalendar.mjs';

export function getPostaCalDavLitePrincipal() {
  return {
    ok: true,
    version: 1,
    note: 'ICS + REST köprüsü; tam CardDAV/CalDAV sunucu değil',
    calendarHome: '/api/posta/caldav-lite/events',
    supported: ['VEVENT'],
  };
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
