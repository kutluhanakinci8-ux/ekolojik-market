import type { BillEmailIngestionSettings } from '../types/billEmailIngestion';

export interface BillEmailTestResult {
  ok: boolean;
  message: string;
  mailboxCount?: number;
}

export interface BillEmailPollResult {
  ok: boolean;
  message: string;
  processed?: number;
  matched?: number;
  scanned?: number;
  items?: Array<{
    sourceId: string;
    subject: string;
    amount?: number;
    dueDate?: string;
  }>;
}

export interface BillEmailInboxMessage {
  id: string;
  sourceId: string | null;
  sourceLabel?: string | null;
  from: string;
  subject: string;
  receivedAt: string;
  snippet: string;
  amount?: number | null;
  dueDate?: string | null;
  matched: boolean;
}

export async function testBillEmailConnection(
  settings: Pick<BillEmailIngestionSettings, 'imapHost' | 'imapPort' | 'imapUser' | 'imapPassword' | 'inboxAddress'>,
): Promise<BillEmailTestResult> {
  const response = await fetch('/api/bill-email/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await response.json().catch(() => ({}));
  return {
    ok: Boolean(data.ok),
    message: typeof data.message === 'string' ? data.message : 'Bağlantı testi tamamlanamadı',
    mailboxCount: typeof data.mailboxCount === 'number' ? data.mailboxCount : undefined,
  };
}

export async function pollBillEmails(
  settings: BillEmailIngestionSettings,
): Promise<BillEmailPollResult> {
  const response = await fetch('/api/bill-email/poll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  const data = await response.json().catch(() => ({}));
  return {
    ok: Boolean(data.ok),
    message: typeof data.message === 'string' ? data.message : 'E-posta taraması tamamlanamadı',
    processed: typeof data.processed === 'number' ? data.processed : undefined,
    matched: typeof data.matched === 'number' ? data.matched : undefined,
    scanned: typeof data.scanned === 'number' ? data.scanned : undefined,
    items: Array.isArray(data.items) ? data.items : undefined,
  };
}

export async function fetchBillEmailInbox(limit = 20): Promise<{
  ok: boolean;
  messages?: BillEmailInboxMessage[];
}> {
  const response = await fetch(`/api/bill-email/inbox?limit=${limit}`);
  const data = await response.json().catch(() => ({}));
  return {
    ok: Boolean(data.ok),
    messages: Array.isArray(data.messages) ? data.messages : undefined,
  };
}
