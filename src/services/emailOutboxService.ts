export async function fetchEmailHealth(): Promise<{
  ok: boolean;
  smtpConfigured?: boolean;
  smtpVerified?: boolean;
  smtpError?: string | null;
  smtpHost?: string | null;
  smtpHostHint?: string | null;
  from?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
  opsEmail?: string | null;
  contactAutoreply?: boolean;
  counts?: { pending: number; sent: number; failed: number };
}> {
  const res = await fetch('/api/email/health');
  return res.json();
}

export type EmailOutboundAttachment = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export async function sendEmailTest(payload: {
  to: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  html?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: EmailOutboundAttachment[];
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

export async function fetchOutboxMessage(id: string): Promise<{
  ok: boolean;
  folder?: string;
  message?: Record<string, unknown>;
  error?: string;
}> {
  const res = await fetch(`/api/email/outbox/${encodeURIComponent(id)}`);
  return res.json();
}

export async function retryOutboxMessage(id: string): Promise<{
  ok: boolean;
  error?: string;
  processed?: { sent?: number; failed?: number };
}> {
  const res = await fetch('/api/email/outbox/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  });
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

export async function fetchRetentionPolicy(): Promise<{
  ok: boolean;
  policy?: { outboxDays: number; messagingDays: number; contactDays: number };
}> {
  const res = await fetch('/api/system/data-retention/policy');
  return res.json();
}

export async function runDataRetention(): Promise<{
  ok: boolean;
  removed?: Record<string, number>;
  policy?: Record<string, number>;
}> {
  const res = await fetch('/api/system/data-retention/run', { method: 'POST' });
  return res.json();
}
