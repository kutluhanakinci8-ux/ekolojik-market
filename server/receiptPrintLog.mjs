import { appendFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export function receiptPrintLogPath(dataDir, tenantId) {
  if (tenantId && tenantId !== 'main') {
    return join(dataDir, 'tenants', tenantId, 'receipt-print.log');
  }
  return join(dataDir, 'receipt-print.log');
}

export async function appendReceiptPrintLog(dataDir, tenantId, payload) {
  const path = receiptPrintLogPath(dataDir, tenantId);
  await mkdir(dirname(path), { recursive: true });
  const line = `${JSON.stringify({
    at: new Date().toISOString(),
    tenantId: tenantId || 'main',
    ...payload,
  })}\n`;
  await appendFile(path, line, 'utf8');
}
