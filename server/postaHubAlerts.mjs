import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

function alertsPath(dataDir) {
  return join(dataDir, 'posta-hub-alerts.jsonl');
}

/** NB PM-8 inAppHub kanalı — hub uyarı günlüğü (SSE/UI tüketimi için) */
export async function recordPostaHubAlert(dataDir, payload) {
  await mkdir(dataDir, { recursive: true });
  const line = JSON.stringify({
    ...payload,
    at: new Date().toISOString(),
  });
  await appendFile(alertsPath(dataDir), `${line}\n`, 'utf8');
  return { ok: true };
}
