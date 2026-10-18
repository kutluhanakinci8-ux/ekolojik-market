import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { parseMailAttachments } from './mailBodyParse.mjs';

function attachRoot(dataDir) {
  return join(dataDir, 'platform', 'support-inbox', 'attachments');
}

export async function persistPlatformSupportAttachments(dataDir, rawSource) {
  const parsed = parseMailAttachments(rawSource);
  if (!parsed.length) return [];
  const root = attachRoot(dataDir);
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

export async function readPlatformSupportAttachmentFile(dataDir, attachmentId) {
  const root = attachRoot(dataDir);
  const path = join(root, `${attachmentId}.bin`);
  return readFile(path);
}
