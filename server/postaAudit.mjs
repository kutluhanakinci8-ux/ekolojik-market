import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

function auditPath(dataDir) {
  return join(dataDir, 'posta-audit', 'posta-audit.jsonl');
}

export async function logPostaAudit(dataDir, tenantId = 'main', entry = {}) {
  await mkdir(join(dataDir, 'posta-audit'), { recursive: true });
  const row = {
    ts: new Date().toISOString(),
    tenantId,
    action: entry.action ?? 'unknown',
    actor: entry.actor ?? 'pos',
    count: entry.count ?? null,
    folder: entry.folder ?? null,
    meta: entry.meta ?? null,
  };
  await appendFile(auditPath(dataDir), `${JSON.stringify(row)}\n`, 'utf8');
  return { ok: true };
}
