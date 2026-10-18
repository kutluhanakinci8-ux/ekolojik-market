import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseMailAttachments } from './mailBodyParse.mjs';

function attachRoot(dataDir, tenantId) {
  return join(dataDir, 'posta-inbox', tenantId, 'attachments');
}

export async function persistImapAttachments(dataDir, tenantId, rawSource) {
  const parsed = parseMailAttachments(rawSource);
  if (!parsed.length) return [];
  const root = attachRoot(dataDir, tenantId);
  await mkdir(root, { recursive: true });
  const saved = [];
  for (const part of parsed) {
    const id = randomUUID();
    const fileName = part.fileName || 'ek';
    const path = join(root, `${id}.bin`);
    await writeFile(path, Buffer.from(part.dataBase64, 'base64'));
    saved.push({
      id,
      fileName,
      mimeType: part.mimeType || 'application/octet-stream',
      size: part.size ?? 0,
    });
  }
  return saved;
}

export async function readPostaInboxAttachment(dataDir, tenantId, attachmentId) {
  const root = attachRoot(dataDir, tenantId);
  const path = join(root, `${attachmentId}.bin`);
  const data = await readFile(path);
  return data;
}
