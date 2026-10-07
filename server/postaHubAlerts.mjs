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
  try {
    const { notifyPostaWebPushLite } = await import('./postaWebPush.mjs');
    const title =
      payload.event === 'messaging'
        ? `Mesaj: ${payload.customerName ?? 'Müşteri'}`
        : payload.event === 'outbox_failed'
          ? 'Outbox hatası'
          : 'Posta hub uyarısı';
    const body = String(payload.preview ?? payload.subject ?? payload.error ?? payload.event ?? '').slice(
      0,
      180,
    );
    await notifyPostaWebPushLite(dataDir, {
      title,
      body,
      url: '/',
      tag: `posta-${payload.event ?? 'alert'}`,
    });
  } catch {
    /* push opsiyonel */
  }
  return { ok: true };
}
