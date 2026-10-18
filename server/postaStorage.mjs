import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { POSTA_COMPOSE_MAX_ATTACH_BYTES } from './postaComposeActions.mjs';

export const POSTA_STORAGE_QUOTA_BYTES =
  Number(process.env.EKOLOJIK_POSTA_STORAGE_QUOTA_MB || 512) * 1024 * 1024;

async function dirSizeBytes(root) {
  let total = 0;
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        total += await dirSizeBytes(path);
      } else if (entry.isFile()) {
        const info = await stat(path);
        total += info.size;
      }
    }
  } catch {
    /* missing */
  }
  return total;
}

export async function getPostaStorageSummary(dataDir, tenantId = 'main') {
  const breakdown = {
    inbox: await dirSizeBytes(join(dataDir, 'posta-inbox', tenantId)),
    outbox: await dirSizeBytes(join(dataDir, 'email-outbox')),
    messaging:
      (await dirSizeBytes(join(dataDir, 'messaging', tenantId))) +
      (await dirSizeBytes(join(dataDir, 'messaging-attachments', tenantId))),
    contacts: await dirSizeBytes(join(dataDir, 'posta-contacts', tenantId)),
    calendar: await dirSizeBytes(join(dataDir, 'posta-calendar', tenantId)),
  };
  const usedBytes = Object.values(breakdown).reduce((sum, n) => sum + n, 0);
  const quotaBytes = POSTA_STORAGE_QUOTA_BYTES;
  const percent = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;
  return {
    ok: true,
    usedBytes,
    quotaBytes,
    percent,
    breakdown,
    maxAttachmentBytes: POSTA_COMPOSE_MAX_ATTACH_BYTES,
  };
}
