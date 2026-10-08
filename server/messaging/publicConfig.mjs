import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export function generateMessagingPublicKey() {
  return randomBytes(24).toString('base64url');
}

function configPath(dataDir, tenantId = 'main') {
  return join(dataDir, 'messaging', tenantId, 'public-config.json');
}

async function readConfigFile(dataDir, tenantId) {
  try {
    const raw = JSON.parse(await readFile(configPath(dataDir, tenantId), 'utf8'));
    return {
      enabled: raw.enabled !== false,
      publicKey: String(raw.publicKey ?? '').trim(),
      rotatedAt: raw.rotatedAt ?? null,
      createdAt: raw.createdAt ?? null,
      allowedOrigins: Array.isArray(raw.allowedOrigins)
        ? raw.allowedOrigins.map((o) => String(o).trim()).filter(Boolean)
        : [],
    };
  } catch {
    return { enabled: true, publicKey: '', rotatedAt: null, createdAt: null, allowedOrigins: [] };
  }
}

export function maskMessagingPublicKey(key) {
  const k = String(key ?? '').trim();
  if (!k) return '';
  if (k.length <= 12) return `${k.slice(0, 3)}…`;
  return `${k.slice(0, 6)}…${k.slice(-4)}`;
}

export async function resolveEffectiveMessagingPublicKey(dataDir, tenantId = 'main') {
  const file = await readConfigFile(dataDir, tenantId);
  if (file.enabled && file.publicKey) {
    return { key: file.publicKey, source: 'tenant', rotatedAt: file.rotatedAt };
  }
  const envKey = process.env.EKOLOJIK_MESSAGING_PUBLIC_KEY?.trim() || '';
  if (envKey) {
    return { key: envKey, source: 'env', rotatedAt: null };
  }
  return { key: '', source: null, rotatedAt: null };
}

export async function isMessagingPublicApiConfigured(dataDir, tenantId = 'main') {
  const resolved = await resolveEffectiveMessagingPublicKey(dataDir, tenantId);
  return Boolean(resolved.key);
}

export async function getMessagingPublicConfigHub(dataDir, tenantId = 'main') {
  const file = await readConfigFile(dataDir, tenantId);
  const effective = await resolveEffectiveMessagingPublicKey(dataDir, tenantId);
  const tenantKey = file.enabled && file.publicKey ? file.publicKey : '';
  return {
    ok: true,
    tenantId,
    enabled: file.enabled,
    hasTenantKey: Boolean(tenantKey),
    publicKey: tenantKey,
    publicKeyMasked: maskMessagingPublicKey(tenantKey || effective.key),
    effectiveSource: effective.source,
    configured: Boolean(effective.key),
    rotatedAt: file.rotatedAt,
    apiPrefix: '/api/public/messaging/v1',
    authHeader: 'x-ekolojik-messaging-key',
    allowedOrigins: file.allowedOrigins ?? [],
    widgetScriptUrl: '/widget/messaging.js',
  };
}

export async function saveMessagingPublicConfig(dataDir, tenantId, patch = {}) {
  const current = await readConfigFile(dataDir, tenantId);
  const dir = join(dataDir, 'messaging', tenantId);
  await mkdir(dir, { recursive: true });

  let publicKey = current.publicKey;
  let rotatedAt = current.rotatedAt;
  const now = new Date().toISOString();

  if (patch.rotate === true) {
    publicKey = generateMessagingPublicKey();
    rotatedAt = now;
  } else if (patch.publicKey !== undefined) {
    publicKey = String(patch.publicKey ?? '').trim();
    if (publicKey) rotatedAt = now;
  }

  const enabled = patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled;

  let allowedOrigins = current.allowedOrigins ?? [];
  if (patch.allowedOrigins !== undefined) {
    allowedOrigins = Array.isArray(patch.allowedOrigins)
      ? patch.allowedOrigins.map((o) => String(o).trim()).filter(Boolean)
      : [];
  }

  const next = {
    enabled,
    publicKey,
    rotatedAt,
    createdAt: current.createdAt || now,
    updatedAt: now,
    allowedOrigins,
  };
  await writeFile(configPath(dataDir, tenantId), JSON.stringify(next, null, 2), 'utf8');
  return { ok: true, config: next };
}
