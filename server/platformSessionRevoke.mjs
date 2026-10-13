import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from './tenantAuth.mjs';

function epochPath(dataDir) {
  return join(dataDir, 'platform', 'session-epoch.json');
}

export async function readPlatformSessionEpoch(dataDir) {
  try {
    const raw = JSON.parse(await readFile(epochPath(dataDir), 'utf8'));
    return Number(raw?.epoch) || 0;
  } catch {
    return 0;
  }
}

export async function bumpPlatformSessionEpoch(dataDir) {
  const epoch = (await readPlatformSessionEpoch(dataDir)) + 1;
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(
    epochPath(dataDir),
    JSON.stringify({ epoch, updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
  return epoch;
}

export async function bumpTenantUserAuthEpoch(dataDir, tenantId, userId) {
  const store = await readTenantStore(dataDir, tenantId);
  if (!store?.users?.length) {
    return { ok: false, status: 404, error: 'Mağaza bulunamadı' };
  }
  const user = store.users.find((u) => u.id === userId);
  if (!user) {
    return { ok: false, status: 404, error: 'Kullanıcı bulunamadı' };
  }
  user.authEpoch = (Number(user.authEpoch) || 0) + 1;
  user.updatedAt = new Date().toISOString();
  await writeTenantStore(dataDir, tenantId, store);
  return {
    ok: true,
    authEpoch: user.authEpoch,
    username: user.username,
    tenantId,
  };
}
