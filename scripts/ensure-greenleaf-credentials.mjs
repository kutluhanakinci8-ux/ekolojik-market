#!/usr/bin/env node
/**
 * main tenant — credential vault + store.json şifre hash onarımı.
 * Kullanım: node scripts/ensure-greenleaf-credentials.mjs [--data-dir /var/www/market-pos/data]
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  mergeUsersIntoVault,
  applyVaultToStoreSnapshot,
  writeCredentialVault,
  readCredentialVault,
} from '../server/credentialVault.mjs';

const dataDir = process.argv.includes('--data-dir')
  ? process.argv[process.argv.indexOf('--data-dir') + 1]
  : join(process.cwd(), 'data');

const ADMIN_HASH = '6e4896950cae800fae0e3e1ae26f1ee90e9a70c7c30fb95715f28be0ce13eac0';
const CASHIER_HASH = 'c2b3ad8c4da0c33240128ade14f44f9996407e1df97b97564c26e6da292fd715';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

const ownerPassword = process.env.GREENLEAF_OWNER_PASSWORD?.trim() || 'EkoPos2026';

const seedUsers = [
  { username: 'kutluhan08', passwordHash: sha256(ownerPassword) },
  { username: 'yonetici', passwordHash: ADMIN_HASH },
  { username: 'kasiyer', passwordHash: CASHIER_HASH },
];

const storePath = join(dataDir, 'store.json');
const raw = JSON.parse(await readFile(storePath, 'utf8'));
let vault = await readCredentialVault(dataDir, 'main');
vault = mergeUsersIntoVault(vault, seedUsers.map((s) => ({ username: s.username, passwordHash: s.passwordHash })));

const users = (raw.users ?? []).map((u) => {
  const seed = seedUsers.find((s) => s.username === u.username);
  if (!seed) return u;
  return { ...u, passwordHash: seed.passwordHash, updatedAt: new Date().toISOString() };
});
const store = applyVaultToStoreSnapshot({ ...raw, users, updatedAt: new Date().toISOString() }, vault);

await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
await writeCredentialVault(dataDir, 'main', vault);

console.log('OK credential vault + store.json', seedUsers.map((s) => s.username).join(', '));
