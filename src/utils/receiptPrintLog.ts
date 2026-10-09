import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { posApiAuthHeaders, posApiFetch } from '../services/posApiAuth';

export interface ReceiptPrintLogEntry {
  t: number;
  phase: string;
  detail?: Record<string, unknown>;
}

const MAX_ENTRIES = 80;
const buffer: ReceiptPrintLogEntry[] = [];

function logUrl(): string {
  const tenant = loadTenantId();
  const base = '/api/pos/receipt-print-log';
  if (!tenant || tenant === DEFAULT_TENANT_ID) return base;
  return `${base}?tenant=${encodeURIComponent(tenant)}`;
}

export function logReceiptPrint(phase: string, detail?: Record<string, unknown>): void {
  const entry: ReceiptPrintLogEntry = { t: Date.now(), phase, detail };
  buffer.push(entry);
  if (buffer.length > MAX_ENTRIES) buffer.shift();
  console.info('[market-pos-fis]', phase, detail ?? '');
  void postReceiptPrintLog(phase, detail);
}

export function getReceiptPrintLog(): ReceiptPrintLogEntry[] {
  return [...buffer];
}

export function getLastReceiptPrintError(): string | null {
  for (let i = buffer.length - 1; i >= 0; i -= 1) {
    const e = buffer[i];
    if (e.phase.includes('error') || e.phase.includes('blocked')) {
      return `${e.phase}${e.detail ? ` ${JSON.stringify(e.detail)}` : ''}`;
    }
  }
  return null;
}

async function postReceiptPrintLog(phase: string, detail?: Record<string, unknown>): Promise<void> {
  try {
    await posApiFetch(logUrl(), {
      method: 'POST',
      headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ phase, detail, userAgent: navigator.userAgent }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    /* sunucu logu isteğe bağlı */
  }
}
