import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

function auditPath(dataDir) {
  return join(dataDir, 'audit', 'posta-access.jsonl');
}

export async function logPostaAccessExport(dataDir, entry) {
  const dir = join(dataDir, 'audit');
  await mkdir(dir, { recursive: true });
  const line = JSON.stringify({
    at: new Date().toISOString(),
    ...entry,
  });
  await appendFile(auditPath(dataDir), `${line}\n`, 'utf8');
}
