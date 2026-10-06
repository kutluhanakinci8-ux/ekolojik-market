import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
]);

function attachmentsRoot(dataDir, tenantId = 'main') {
  return join(dataDir, 'messaging-attachments', tenantId);
}

function safeFileName(name) {
  return String(name ?? 'dosya')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120) || 'dosya';
}

export async function saveMessageAttachments(dataDir, tenantId, messageId, items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const root = attachmentsRoot(dataDir, tenantId);
  await mkdir(root, { recursive: true });
  const saved = [];

  for (const item of items.slice(0, 5)) {
    const fileName = safeFileName(item.fileName);
    const mimeType = String(item.mimeType ?? 'application/octet-stream').trim();
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new Error(`Desteklenmeyen dosya türü: ${mimeType}`);
    }
    const b64 = String(item.dataBase64 ?? '').replace(/^data:[^;]+;base64,/, '');
    if (!b64) continue;
    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length > MAX_BYTES) {
      throw new Error(`Dosya çok büyük (max ${MAX_BYTES / 1024 / 1024} MB): ${fileName}`);
    }

    const id = `att-${randomUUID()}`;
    const storedName = `${id}_${fileName}`;
    const path = join(root, storedName);
    await writeFile(path, buffer);
    saved.push({
      id,
      fileName,
      mimeType,
      size: buffer.length,
      url: `/api/messaging/attachments/${encodeURIComponent(id)}?tenant=${encodeURIComponent(tenantId)}`,
    });
  }

  return saved;
}

export async function readMessagingAttachment(dataDir, tenantId, attachmentId) {
  const safeId = String(attachmentId).replace(/[^a-zA-Z0-9-]/g, '');
  if (!safeId.startsWith('att-')) {
    return { ok: false, error: 'Geçersiz ek kimliği' };
  }
  const root = attachmentsRoot(dataDir, tenantId);
  const { readdir } = await import('node:fs/promises');
  let files = [];
  try {
    files = await readdir(root);
  } catch {
    return { ok: false, error: 'Ek bulunamadı' };
  }
  const hit = files.find((f) => f.startsWith(`${safeId}_`));
  if (!hit) return { ok: false, error: 'Ek bulunamadı' };

  const path = join(root, hit);
  const info = await stat(path);
  const data = await readFile(path);
  const fileName = hit.slice(safeId.length + 1);
  const mimeType = fileName.endsWith('.pdf')
    ? 'application/pdf'
    : fileName.match(/\.(jpe?g|png|gif|webp)$/i)
      ? `image/${fileName.split('.').pop()?.toLowerCase().replace('jpg', 'jpeg')}`
      : 'application/octet-stream';

  return {
    ok: true,
    fileName,
    mimeType,
    size: info.size,
    data,
  };
}

export async function pruneMessagingAttachments(dataDir, tenantId, olderThanIso) {
  const root = attachmentsRoot(dataDir, tenantId);
  const cutoff = Date.parse(olderThanIso);
  if (!Number.isFinite(cutoff)) return { removed: 0 };

  const { readdir, unlink } = await import('node:fs/promises');
  let files = [];
  try {
    files = await readdir(root);
  } catch {
    return { removed: 0 };
  }

  let removed = 0;
  for (const file of files) {
    const path = join(root, file);
    try {
      const info = await stat(path);
      if (info.mtimeMs < cutoff) {
        await unlink(path);
        removed += 1;
      }
    } catch {
      /* skip */
    }
  }
  return { removed };
}
