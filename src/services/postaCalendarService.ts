export type PostaCalendarEvent = {
  id: string;
  kind: 'payment' | 'manual' | 'mail' | 'snooze' | string;
  title: string;
  date: string;
  at: string;
  amount?: number | null;
  notes?: string | null;
  mailId?: string | null;
  source?: string;
  editable?: boolean;
};

export async function fetchPostaCalendar(limit = 120) {
  const res = await fetch(`/api/posta/calendar?limit=${limit}`);
  return res.json() as Promise<{ ok: boolean; events?: PostaCalendarEvent[]; error?: string }>;
}

export async function savePostaCalendarEvent(payload: {
  id?: string;
  title: string;
  date: string;
  notes?: string;
  kind?: string;
  mailId?: string;
}) {
  const res = await fetch('/api/posta/calendar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; event?: PostaCalendarEvent; error?: string }>;
}

export async function deletePostaCalendarEvent(id: string) {
  const res = await fetch(`/api/posta/calendar/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export async function syncPostaPaymentReminders(
  reminders: Array<{ id: string; title: string; dueDate: string; amount?: number; notes?: string }>,
) {
  const res = await fetch('/api/posta/calendar/sync-payments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reminders }),
  });
  return res.json() as Promise<{ ok: boolean; count?: number; error?: string }>;
}

export async function addMailToPostaCalendar(payload: {
  mailId: string;
  subject: string;
  date?: string;
  notes?: string;
}) {
  const res = await fetch('/api/posta/calendar/from-mail', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; event?: PostaCalendarEvent; error?: string }>;
}
