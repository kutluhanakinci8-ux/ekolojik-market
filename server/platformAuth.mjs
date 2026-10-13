import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createPosApiToken, verifyPosApiToken } from './posApiAuth.mjs';
import {
  PLATFORM_TENANT_ID,
  isPlatformOperatorUsername,
  normalizePlatformOperatorUsername,
} from './platformOperators.mjs';

function hashPassword(password) {
  return createHash('sha256').update(String(password)).digest('hex');
}

function platformMetaPath(dataDir) {
  return join(dataDir, 'platform', 'operators.json');
}

function platformVaultPath(dataDir) {
  return join(dataDir, 'credential-vault', '_platform.json');
}

export async function readPlatformOperatorsMeta(dataDir) {
  try {
    const raw = JSON.parse(await readFile(platformMetaPath(dataDir), 'utf8'));
    if (!Array.isArray(raw?.operators)) return { operators: [] };
    return raw;
  } catch {
    return { operators: [] };
  }
}

export async function readPlatformOperatorVault(dataDir) {
  try {
    return JSON.parse(await readFile(platformVaultPath(dataDir), 'utf8'));
  } catch {
    return { users: {} };
  }
}

export async function writePlatformOperatorVault(dataDir, vault) {
  await mkdir(join(dataDir, 'credential-vault'), { recursive: true });
  await writeFile(platformVaultPath(dataDir), JSON.stringify(vault, null, 2), 'utf8');
}

export async function upsertPlatformOperator(dataDir, { username, passwordHash, recoveryEmail, displayName }) {
  const canonical = normalizePlatformOperatorUsername(username);
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  const meta = await readPlatformOperatorsMeta(dataDir);
  const operators = meta.operators.filter((o) => o.username !== canonical);
  operators.push({
    username: canonical,
    displayName: displayName ?? 'Platform Yönetimi',
    recoveryEmail: recoveryEmail?.includes('@') ? recoveryEmail.trim().toLowerCase() : undefined,
    updatedAt: new Date().toISOString(),
  });
  await writeFile(platformMetaPath(dataDir), JSON.stringify({ operators }, null, 2), 'utf8');

  const vault = await readPlatformOperatorVault(dataDir);
  vault.users = vault.users ?? {};
  vault.users[canonical] = { passwordHash, updatedAt: new Date().toISOString() };
  await writePlatformOperatorVault(dataDir, vault);
}

export async function issuePlatformApiTokenFromCredentials(dataDir, { username, password }) {
  const canonical = normalizePlatformOperatorUsername(username);
  if (!isPlatformOperatorUsername(canonical)) {
    return { ok: false, status: 401, message: 'Kullanıcı adı veya şifre hatalı' };
  }
  const vault = await readPlatformOperatorVault(dataDir);
  const secret = vault.users?.[canonical]?.passwordHash;
  if (!secret || hashPassword(String(password ?? '')) !== secret) {
    return { ok: false, status: 401, message: 'Kullanıcı adı veya şifre hatalı' };
  }
  const meta = (await readPlatformOperatorsMeta(dataDir)).operators.find((o) => o.username === canonical);
  const userId = `platform:${canonical}`;
  const { readPlatformSessionEpoch } = await import('./platformSessionRevoke.mjs');
  const platformEpoch = await readPlatformSessionEpoch(dataDir);
  const token = await createPosApiToken(dataDir, {
    tenantId: PLATFORM_TENANT_ID,
    userId,
    role: 'platform',
    username: canonical,
    platformEpoch,
  });
  const exp = Date.now() + 24 * 60 * 60 * 1000;
  return {
    ok: true,
    token,
    expiresInSec: Math.floor((24 * 60 * 60 * 1000) / 1000),
    expiresAt: new Date(exp).toISOString(),
    role: 'platform',
    userId,
    tenantId: PLATFORM_TENANT_ID,
    user: {
      id: userId,
      username: canonical,
      displayName: meta?.displayName ?? 'Platform Yönetimi',
      role: 'admin',
      recoveryEmail: meta?.recoveryEmail,
      isActive: true,
      allowedTabs: [],
    },
  };
}

export async function assertPlatformApiAuth(req, res, dataDir) {
  const { extractBearerToken } = await import('./posApiAuth.mjs');
  const token = extractBearerToken(req);
  const result = await verifyPosApiToken(dataDir, token, PLATFORM_TENANT_ID, { requirePlatform: true });
  if (!result.ok) {
    res.writeHead(result.status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: result.error }));
    return false;
  }
  return result.payload;
}
