#!/usr/bin/env node
/** Canlı data: kutluhan* kullanıcılarını tam yönetici yapar */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { elevateOwnerAdminsInStore } from '../server/ownerAdminElevate.mjs';

const dataDir = process.env.MARKET_POS_DATA_DIR || '/var/www/market-pos/data';

async function patchStore(path) {
  let store;
  try {
    store = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return false;
  }
  const { store: next, changed } = elevateOwnerAdminsInStore(store);
  if (!changed) return false;
  await writeFile(path, JSON.stringify(next, null, 2), 'utf8');
  return true;
}

const paths = [join(dataDir, 'store.json')];
try {
  const { readdir } = await import('node:fs/promises');
  const tenants = join(dataDir, 'tenants');
  for (const name of await readdir(tenants)) {
    paths.push(join(tenants, name, 'store.json'));
  }
} catch {
  /* no tenants */
}

let n = 0;
for (const p of paths) {
  if (await patchStore(p)) {
    console.log('✓ owner admin:', p);
    n += 1;
  }
}
console.log(n ? `Tamam (${n} mağaza güncellendi).` : 'Değişiklik gerekmedi veya store yok.');
