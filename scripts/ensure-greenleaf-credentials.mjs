#!/usr/bin/env node
/**
 * main tenant — credential vault + store.json şifre hash onarımı.
 * Şifreler repoda tutulmaz; yalnızca ortam değişkenleri.
 *
 * Kullanım:
 *   GREENLEAF_OWNER_PASSWORD='...' node scripts/ensure-greenleaf-credentials.mjs --data-dir /var/www/market-pos/data
 *
 * İsteğe bağlı:
 *   GREENLEAF_DEMO_ADMIN_PASSWORD — yonetici (varsayılan seed hash korunur)
 *   GREENLEAF_DEMO_CASHIER_PASSWORD — kasiyer (varsayılan seed hash korunur)
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

const DEFAULT_ADMIN_HASH = '6e4896950cae800fae0e3e1ae26f1ee90e9a70c7c30fb95715f28be0ce13eac0';
const DEFAULT_CASHIER_HASH = 'c2b3ad8c4da0c33240128ade14f44f9996407e1df97b97564c26e6da292fd715';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

const ownerPassword = process.env.GREENLEAF_OWNER_PASSWORD?.trim();
if (!ownerPassword) {
  console.error('HATA: GREENLEAF_OWNER_PASSWORD ortam değişkeni gerekli (kutluhan08 şifresi).');
  process.exit(1);
}

const seedUsers = [
  { username: 'kutluhan08', passwordHash: sha256(ownerPassword) },
];

const demoAdminPassword = process.env.GREENLEAF_DEMO_ADMIN_PASSWORD?.trim();
if (demoAdminPassword) {
  seedUsers.push({ username: 'yonetici', passwordHash: sha256(demoAdminPassword) });
} else {
  seedUsers.push({ username: 'yonetici', passwordHash: DEFAULT_ADMIN_HASH });
}

const demoCashierPassword = process.env.GREENLEAF_DEMO_CASHIER_PASSWORD?.trim();
if (demoCashierPassword) {
  seedUsers.push({ username: 'kasiyer', passwordHash: sha256(demoCashierPassword) });
} else {
  seedUsers.push({ username: 'kasiyer', passwordHash: DEFAULT_CASHIER_HASH });
}

const storePath = join(dataDir, 'store.json');
const raw = JSON.parse(await readFile(storePath, 'utf8'));
let vault = await readCredentialVault(dataDir, 'main');
vault = mergeUsersIntoVault(vault, seedUsers);

const ownerRecoveryEmail = process.env.GREENLEAF_OWNER_RECOVERY_EMAIL?.trim().toLowerCase();

const users = (raw.users ?? []).map((u) => {
  const seed = seedUsers.find((s) => s.username === u.username);
  const patch = { ...u, updatedAt: new Date().toISOString() };
  if (seed) patch.passwordHash = seed.passwordHash;
  if (u.username === 'kutluhan08' && ownerRecoveryEmail?.includes('@')) {
    patch.recoveryEmail = ownerRecoveryEmail;
  }
  if (!seed && u.username !== 'kutluhan08') return u;
  return patch;
});
const store = applyVaultToStoreSnapshot({ ...raw, users, updatedAt: new Date().toISOString() }, vault);

await writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
await writeCredentialVault(dataDir, 'main', vault);

console.log('OK credential vault + store.json', seedUsers.map((s) => s.username).join(', '));
