/**
 * Kimlik bilgileri store.json senkronundan ayrı tutulur (Square / Shopify POS modeli).
 * İstemci PUT asla şifre hash'ini silmez — kasa verisi ile kullanıcı sırları ayrı dosyada.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const SECRET_FIELDS = ['passwordHash', 'pinHash', 'totpSecret'];

function vaultPath(dataDir, tenantId) {
  const id = String(tenantId ?? 'main').trim() || 'main';
  return join(dataDir, 'credential-vault', `${id}.json`);
}

function normalizeUsername(username) {
  return String(username ?? '').trim().toLowerCase();
}

function isSha256Hex(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
}

export async function readCredentialVault(dataDir, tenantId) {
  const path = vaultPath(dataDir, tenantId);
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { users: {} };
    const users = parsed.users && typeof parsed.users === 'object' ? parsed.users : {};
    return { users, updatedAt: parsed.updatedAt };
  } catch {
    return { users: {} };
  }
}

export async function writeCredentialVault(dataDir, tenantId, vault) {
  const path = vaultPath(dataDir, tenantId);
  await mkdir(join(path, '..'), { recursive: true });
  const payload = {
    updatedAt: new Date().toISOString(),
    users: vault.users ?? {},
  };
  await writeFile(path, JSON.stringify(payload, null, 2), 'utf8');
  return payload;
}

/** store.users içindeki geçerli sırları kasaya yazar (ilk kurulum / geri yükleme). */
export function seedVaultFromStoreUsers(vault, storeUsers) {
  if (!Array.isArray(storeUsers)) return vault;
  const users = { ...(vault.users ?? {}) };
  for (const user of storeUsers) {
    const key = normalizeUsername(user.username);
    if (!key) continue;
    const entry = { ...(users[key] ?? {}) };
    for (const field of SECRET_FIELDS) {
      const val = user[field];
      if (val && String(val).trim()) {
        entry[field] = String(val).trim();
      }
    }
    if (Object.keys(entry).length > 0) {
      users[key] = entry;
    }
  }
  return { ...vault, users };
}

/** Kasadan kullanıcıya sırları uygula (store hash boşsa). */
export function applyVaultSecretsToUser(user, vault) {
  if (!user || typeof user !== 'object') return user;
  const key = normalizeUsername(user.username);
  const entry = vault?.users?.[key];
  if (!entry) return user;
  const next = { ...user };
  for (const field of SECRET_FIELDS) {
    const vaultVal = entry[field];
    const current = next[field];
    if (vaultVal && (!current || current === '')) {
      next[field] = vaultVal;
    }
  }
  return next;
}

export function applyVaultToStoreSnapshot(store, vault) {
  if (!store || typeof store !== 'object' || !Array.isArray(store.users)) return store;
  return {
    ...store,
    users: store.users.map((user) => applyVaultSecretsToUser(user, vault)),
  };
}

/** Kasayı güncelle; kasadaki sırları asla boşlukla ezme. */
export function mergeUsersIntoVault(vault, users) {
  const nextUsers = { ...(vault.users ?? {}) };
  if (!Array.isArray(users)) return { ...vault, users: nextUsers };
  for (const user of users) {
    const key = normalizeUsername(user.username);
    if (!key) continue;
    const entry = { ...(nextUsers[key] ?? {}) };
    for (const field of SECRET_FIELDS) {
      const val = user[field];
      if (field === 'passwordHash' && val && !isSha256Hex(val)) continue;
      if (val && String(val).trim()) {
        entry[field] = String(val).trim();
      }
    }
    if (Object.keys(entry).length > 0) {
      nextUsers[key] = entry;
    }
  }
  return { ...vault, users: nextUsers };
}

/**
 * İstemci PUT: sırları düşür; yalnızca geçerli yeni passwordHash (şifre değişimi) geçer.
 */
export function stripUntrustedUserSecretsFromIncoming(incoming, vault) {
  if (!incoming || !Array.isArray(incoming.users)) return incoming;
  const vaultUsers = vault?.users ?? {};
  const users = incoming.users.map((user) => {
    if (!user || typeof user !== 'object') return user;
    const key = normalizeUsername(user.username);
    const vaultEntry = vaultUsers[key] ?? {};
    const { passwordHash, pinHash, totpSecret, ...rest } = user;
    const out = { ...rest };
    if (
      isSha256Hex(passwordHash)
      && passwordHash !== vaultEntry.passwordHash
    ) {
      out.passwordHash = passwordHash;
    }
    if (pinHash && String(pinHash).trim() && pinHash !== vaultEntry.pinHash) {
      out.pinHash = String(pinHash).trim();
    }
    if (totpSecret && String(totpSecret).trim() && totpSecret !== vaultEntry.totpSecret) {
      out.totpSecret = String(totpSecret).trim();
    }
    return out;
  });
  return { ...incoming, users };
}

export async function hydrateStoreWithCredentialVault(dataDir, tenantId, store) {
  const vault = await readCredentialVault(dataDir, tenantId);
  let merged = seedVaultFromStoreUsers(vault, store?.users);
  const withSecrets = applyVaultToStoreSnapshot(store, merged);
  return { store: withSecrets, vault: merged };
}

export async function persistVaultAfterStoreWrite(dataDir, tenantId, store) {
  const vault = await readCredentialVault(dataDir, tenantId);
  const nextVault = mergeUsersIntoVault(vault, store?.users);
  await writeCredentialVault(dataDir, tenantId, nextVault);
  return nextVault;
}
