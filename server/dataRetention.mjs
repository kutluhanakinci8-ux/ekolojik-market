import { readdir, readFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pruneMessagingAttachments } from './messaging/attachments.mjs';
import { getOutboxCounts } from './emailOutbox.mjs';

function retentionDays(envKey, fallback) {
  const n = Number(process.env[envKey]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function cutoffDate(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

async function pruneOutboxFolder(dir, cutoffMs) {
  let removed = 0;
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
  } catch {
    return 0;
  }
  for (const file of files) {
    const path = join(dir, file);
    try {
      const raw = await readFile(path, 'utf8');
      const row = JSON.parse(raw);
      const ts = Date.parse(row.sentAt || row.createdAt || 0);
      if (Number.isFinite(ts) && ts < cutoffMs) {
        await unlink(path);
        removed += 1;
      }
    } catch {
      /* skip */
    }
  }
  return removed;
}

export async function runEkolojikDataRetention(dataDir, tenantId = 'main') {
  const outboxDays = retentionDays('EKOLOJIK_OUTBOX_RETENTION_DAYS', 90);
  const messagingDays = retentionDays('EKOLOJIK_MESSAGING_RETENTION_DAYS', 365);
  const contactDays = retentionDays('EKOLOJIK_CONTACT_RETENTION_DAYS', 730);

  const outboxCutoff = Date.parse(cutoffDate(outboxDays));
  const root = join(dataDir, 'email-outbox');
  let outboxRemoved = 0;
  for (const sub of ['sent', 'failed']) {
    outboxRemoved += await pruneOutboxFolder(join(root, sub), outboxCutoff);
  }

  const attach = await pruneMessagingAttachments(dataDir, tenantId, cutoffDate(messagingDays));

  let contactRemoved = 0;
  const contactPath = join(dataDir, 'contact-messages.json');
  try {
    const items = JSON.parse(await readFile(contactPath, 'utf8'));
    if (Array.isArray(items)) {
      const contactCutoff = Date.parse(cutoffDate(contactDays));
      const kept = items.filter((row) => {
        const ts = Date.parse(row.createdAt || 0);
        return !Number.isFinite(ts) || ts >= contactCutoff;
      });
      contactRemoved = items.length - kept.length;
      if (contactRemoved > 0) {
        const { writeFile } = await import('node:fs/promises');
        await writeFile(contactPath, JSON.stringify(kept, null, 2), 'utf8');
      }
    }
  } catch {
    /* no file */
  }

  const counts = await getOutboxCounts(dataDir);

  return {
    ok: true,
    policy: {
      outboxDays,
      messagingDays,
      contactDays,
    },
    removed: {
      outboxSentFailed: outboxRemoved,
      messagingAttachments: attach.removed,
      contactMessages: contactRemoved,
    },
    counts,
    ranAt: new Date().toISOString(),
  };
}

export function getRetentionPolicySummary() {
  return {
    outboxDays: retentionDays('EKOLOJIK_OUTBOX_RETENTION_DAYS', 90),
    messagingDays: retentionDays('EKOLOJIK_MESSAGING_RETENTION_DAYS', 365),
    contactDays: retentionDays('EKOLOJIK_CONTACT_RETENTION_DAYS', 730),
  };
}
