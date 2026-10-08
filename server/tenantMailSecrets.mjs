import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { getPosApiSecret } from './posApiAuth.mjs';

const PREFIX = 'enc:v1:';

function deriveKey(secret) {
  return createHash('sha256').update(`tenant-mail:${secret}`).digest();
}

export async function encryptTenantMailSecret(dataDir, plain) {
  const text = String(plain ?? '');
  if (!text) return '';
  const secret = await getPosApiSecret(dataDir);
  const key = deriveKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}.${enc.toString('base64url')}.${tag.toString('base64url')}`;
}

export async function decryptTenantMailSecret(dataDir, stored) {
  const raw = String(stored ?? '');
  if (!raw) return '';
  if (!raw.startsWith(PREFIX)) return raw;
  const body = raw.slice(PREFIX.length);
  const [ivB64, dataB64, tagB64] = body.split('.');
  if (!ivB64 || !dataB64 || !tagB64) return raw;
  try {
    const secret = await getPosApiSecret(dataDir);
    const key = deriveKey(secret);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return dec.toString('utf8');
  } catch {
    return '';
  }
}

export function isEncryptedTenantMailSecret(value) {
  return String(value ?? '').startsWith(PREFIX);
}
