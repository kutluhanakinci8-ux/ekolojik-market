import { posHubFetch } from './posHubFetch';

export type JmapLiteEmail = {
  id: string;
  subject: string;
  from: string;
  receivedAt: string;
  preview: string;
  unread: boolean;
  bodyText?: string;
  bodyHtml?: string;
};

export async function fetchJmapLiteMailboxes() {
  const res = await posHubFetch('/api/posta/jmap-lite/Mailbox/query');
  return res.json() as Promise<{ ok: boolean; mailboxes?: { id: string; name: string }[] }>;
}

export async function fetchJmapLiteEmails(folder: string, limit = 60) {
  const params = new URLSearchParams({ folder, limit: String(limit) });
  const res = await posHubFetch(`/api/posta/jmap-lite/Email/query?${params}`);
  return res.json() as Promise<{ ok: boolean; emails?: JmapLiteEmail[]; error?: string }>;
}

export async function setJmapLiteEmails(
  updates: { id: string; unread?: boolean; keywords?: string[] }[],
) {
  const res = await posHubFetch('/api/posta/jmap-lite/Email/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates }),
  });
  return res.json() as Promise<{ ok: boolean; updated?: number; error?: string }>;
}
