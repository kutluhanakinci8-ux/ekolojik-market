import {
  markPostaInboxRead,
  archivePostaInboxItem,
  applyPostaInboxFlags,
  listUnifiedPostaInbox,
} from './postaInbox.mjs';
import { logPostaAudit } from './postaAudit.mjs';

const MAX_BATCH = 100;

async function runItemAction(dataDir, tenantId, action, item) {
  const id = String(item?.id ?? '');
  const kind = String(item?.kind ?? '');
  const sourceId = item?.sourceId ?? id;
  if (!id) return { ok: false, error: 'id gerekli' };

  switch (action) {
    case 'read':
      return markPostaInboxRead(dataDir, tenantId, { id, kind, sourceId });
    case 'archive':
      return archivePostaInboxItem(dataDir, tenantId, { id, kind, sourceId });
    case 'spam':
      return applyPostaInboxFlags(dataDir, tenantId, id, { spam: true });
    case 'trash':
      return applyPostaInboxFlags(dataDir, tenantId, id, { trashed: true });
    default:
      return { ok: false, error: 'Geçersiz işlem' };
  }
}

export async function batchPostaInboxAction(dataDir, tenantId, { action, items, actor = 'pos' }) {
  const actionName = String(action ?? '').trim();
  if (!['read', 'archive', 'spam', 'trash'].includes(actionName)) {
    return { ok: false, error: 'action: read|archive|spam|trash' };
  }
  const list = Array.isArray(items) ? items.slice(0, MAX_BATCH) : [];
  if (!list.length) return { ok: false, error: 'items boş' };

  let processed = 0;
  let failed = 0;
  for (const item of list) {
    const result = await runItemAction(dataDir, tenantId, actionName, item);
    if (result?.ok) processed += 1;
    else failed += 1;
  }

  await logPostaAudit(dataDir, tenantId, {
    action: `batch_${actionName}`,
    actor,
    count: processed,
    meta: { failed, requested: list.length },
  });

  return { ok: true, action: actionName, processed, failed };
}

export async function markAllPostaInboxReadInFolder(dataDir, tenantId, folder, actor = 'pos') {
  const folderName = String(folder ?? 'gelen');
  const listed = await listUnifiedPostaInbox(dataDir, tenantId, {
    folder: folderName,
    limit: 200,
    listMode: 'message',
    unread: true,
  });
  const items = (listed.items ?? []).filter((i) => i.unread && i.kind !== 'conversation');
  let processed = 0;
  for (const item of items.slice(0, MAX_BATCH)) {
    const result = await markPostaInboxRead(dataDir, tenantId, {
      id: item.id,
      kind: item.kind,
      sourceId: item.sourceId,
    });
    if (result?.ok) processed += 1;
  }
  await logPostaAudit(dataDir, tenantId, {
    action: 'mark_all_read',
    actor,
    folder: folderName,
    count: processed,
  });
  return { ok: true, folder: folderName, processed };
}
