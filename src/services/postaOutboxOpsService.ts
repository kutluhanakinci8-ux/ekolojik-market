import { posHubFetch } from './posHubFetch';

export type FailedOutboxRow = {
  id: string;
  to: string;
  subject: string;
  source?: string;
  status?: string;
  folder?: string;
  createdAt?: string;
  sentAt?: string | null;
  lastError?: string | null;
  errorClass?: string;
  tenantId?: string;
};

export async function fetchFailedOutboxList(limit = 100): Promise<{
  ok: boolean;
  items?: FailedOutboxRow[];
  counts?: { pending: number; sent: number; failed: number };
  error?: string;
}> {
  const res = await posHubFetch(`/api/posta/outbox/failed?limit=${limit}`);
  return res.json();
}

export async function requeueFailedOutbox(payload: {
  ids?: string[];
  all?: boolean;
}): Promise<{ ok: boolean; requeued?: number; errors?: Array<{ id: string; error: string }>; error?: string }> {
  const res = await posHubFetch('/api/posta/outbox/failed/requeue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function archiveFailedOutbox(payload: {
  ids?: string[];
  all?: boolean;
}): Promise<{ ok: boolean; archived?: number; error?: string }> {
  const res = await posHubFetch('/api/posta/outbox/failed/archive', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}
