export async function fetchEmailHealth(): Promise<{
  ok: boolean;
  smtpConfigured?: boolean;
  smtpVerified?: boolean;
  smtpError?: string | null;
  from?: string | null;
  opsEmail?: string | null;
  contactAutoreply?: boolean;
  counts?: { pending: number; sent: number; failed: number };
}> {
  const res = await fetch('/api/email/health');
  return res.json();
}

export async function sendEmailTest(payload: {
  to: string;
  subject?: string;
  body?: string;
}): Promise<{ ok: boolean; error?: string; provider?: string; message?: string }> {
  const res = await fetch('/api/email/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function processEmailOutbox(): Promise<{ ok: boolean; processed?: number; sent?: number; failed?: number }> {
  const res = await fetch('/api/email/outbox/process', { method: 'POST' });
  return res.json();
}

export async function fetchRecentOutbox(limit = 20): Promise<{
  ok: boolean;
  items?: Array<Record<string, unknown>>;
  counts?: { pending: number; sent: number; failed: number };
}> {
  const res = await fetch(`/api/email/outbox/recent?limit=${limit}`);
  return res.json();
}

export async function fetchEkolojikIsolationReport(): Promise<{
  ok: boolean;
  checks?: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  dataPaths?: string[];
  envHints?: string[];
}> {
  const res = await fetch('/api/system/ekolojik-isolation');
  return res.json();
}
