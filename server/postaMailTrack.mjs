import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

export function isMailTrackEnabled() {
  return String(process.env.EKOLOJIK_MAIL_TRACK ?? '').trim() === '1';
}

function trackLogPath(dataDir) {
  return join(dataDir, 'posta-track', 'opens.jsonl');
}

export function createMailTrackToken(outboxId) {
  const seed = `${outboxId}:${randomUUID()}`;
  return createHash('sha256').update(seed).digest('hex').slice(0, 32);
}

export function injectOpenTrackingPixel(html, token, baseUrl) {
  if (!token?.trim()) return html;
  const base = String(baseUrl ?? '').replace(/\/$/, '') || '';
  const src = `${base}/api/posta/track/open/${token}.gif`;
  const pixel = `<img src="${src}" width="1" height="1" alt="" style="display:none;border:0" />`;
  const body = String(html ?? '').trim();
  if (!body) return pixel;
  if (body.toLowerCase().includes('</body>')) {
    return body.replace(/<\/body>/i, `${pixel}</body>`);
  }
  return `${body}${pixel}`;
}

export async function recordMailOpen(dataDir, token, meta = {}) {
  if (!token?.trim()) return { ok: false };
  await mkdir(join(dataDir, 'posta-track'), { recursive: true });
  const line = JSON.stringify({
    token,
    at: new Date().toISOString(),
    ...meta,
    tenantId: meta.tenantId ?? undefined,
  });
  await appendFile(trackLogPath(dataDir), `${line}\n`, 'utf8');
  try {
    const { notifyEngagementOpen } = await import('./postaEngagement.mjs');
    await notifyEngagementOpen(dataDir, token, meta);
  } catch {
    /* webhook opsiyonel */
  }
  return { ok: true };
}

export function mailTrackPixelResponse() {
  return PIXEL_GIF;
}
