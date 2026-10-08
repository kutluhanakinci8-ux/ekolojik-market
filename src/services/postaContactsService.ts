import { posHubFetch, postaAuthenticatedUrl } from './posHubFetch';

export type PostaContact = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  company?: string | null;
  source: 'customer' | 'manual' | 'suggested';
  customerId?: string | null;
  notes?: string | null;
  manual?: boolean;
  lastCorrespondenceAt?: string | null;
  lastSubject?: string | null;
};

export async function fetchPostaContacts(q = '', limit = 120) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q.trim()) params.set('q', q.trim());
  const res = await posHubFetch(`/api/posta/contacts?${params.toString()}`);
  return res.json() as Promise<{ ok: boolean; contacts?: PostaContact[]; error?: string }>;
}

export async function savePostaContact(payload: Partial<PostaContact> & { name?: string; email?: string }) {
  const res = await posHubFetch('/api/posta/contacts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json() as Promise<{ ok: boolean; contact?: PostaContact; error?: string }>;
}

export async function deletePostaContact(id: string) {
  const res = await posHubFetch(`/api/posta/contacts/${encodeURIComponent(id)}`, { method: 'DELETE' });
  return res.json() as Promise<{ ok: boolean; error?: string }>;
}

export async function importPostaContacts(text: string, format: 'vcf' | 'csv' = 'vcf') {
  const res = await posHubFetch('/api/posta/contacts/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, format }),
  });
  return res.json() as Promise<{ ok: boolean; imported?: number; error?: string }>;
}

export function postaContactsExportVcfUrl() {
  return postaAuthenticatedUrl('/api/posta/contacts/export.vcf');
}
