#!/usr/bin/env node
/**
 * Tenant izolasyon smoke — main vs lima-market
 *   node scripts/verify-tenant-isolation.mjs --data-dir /var/www/market-pos/data
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { guardIsolatedTenantStoreWrite } from '../server/tenantStoreGuard.mjs';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
let failed = 0;

function fail(msg) {
  console.error('FAIL', msg);
  failed += 1;
}
function ok(msg) {
  console.log('OK  ', msg);
}

async function loadTenant(id) {
  const path =
    id === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', id, 'store.json');
  return JSON.parse(await readFile(path, 'utf8'));
}

const main = await loadTenant('main');
const lima = await loadTenant('lima-market');

if ((main.products?.length ?? 0) > 0 && (lima.products?.length ?? 0) === 0) {
  ok('lima-market ürün sayısı main ile karışmıyor (0)');
} else if ((lima.products?.length ?? 0) > 0) {
  fail(`lima-market hâlâ ${lima.products.length} ürün — sıfırlama gerekebilir`);
} else {
  ok('lima-market ürün listesi boş');
}

const limaUsers = new Set((lima.users ?? []).map((u) => u.username));
if (limaUsers.has('yonetici') || limaUsers.has('kasiyer')) {
  fail(`lima-market demo kullanıcıları içeriyor: ${[...limaUsers].join(', ')}`);
} else {
  ok(`lima-market kullanıcıları: ${[...limaUsers].join(', ') || '(boş)'}`);
}

const poisoned = guardIsolatedTenantStoreWrite('lima-market', lima, {
  ...lima,
  users: [...(lima.users ?? []), { username: 'yonetici', id: 'x' }],
  products: Array.from({ length: 137 }, (_, i) => ({ id: `p${i}` })),
});
if (poisoned.users.some((u) => u.username === 'yonetici')) {
  fail('guard yonetici eklemesine izin verdi');
} else {
  ok('guard demo kullanıcı eklemesini engelliyor');
}
if ((poisoned.products?.length ?? 0) >= 30) {
  fail('guard toplu katalog yazımına izin verdi');
} else {
  ok('guard toplu katalog yazımını engelliyor');
}

if (failed > 0) process.exit(1);
console.log('\nTenant isolation: PASS');
