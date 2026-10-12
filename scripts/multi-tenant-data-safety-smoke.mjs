#!/usr/bin/env node
/**
 * Çok mağaza (tenant) veri güvenliği — otomatik smoke.
 * Geçici data dir + yerel server + guard birim testleri.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as sleep } from 'node:timers/promises';
import { createHash } from 'node:crypto';

import {
  guardIsolatedTenantStoreWrite,
  sanitizeIsolatedTenantStoreRead,
} from '../server/tenantStoreGuard.mjs';
import { assertTenantStoreWriteAllowed } from '../server/tenantWritePolicy.mjs';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';

const REPO = join(import.meta.dirname, '..');
const PORT = Number(process.env.EKOLOJIK_MT_PORT || 59123);
const BASE = `http://127.0.0.1:${PORT}`;

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

function adminUser(username, displayName) {
  const now = new Date().toISOString();
  return {
    id: `U-${username}`,
    username,
    displayName,
    role: 'admin',
    isActive: true,
    passwordHash: hashPassword('TestPass123!'),
    createdAt: now,
    updatedAt: now,
  };
}

function minimalStore(businessName, marker) {
  const now = new Date().toISOString();
  return {
    updatedAt: now,
    products: [{ id: marker, name: `${businessName} Ürün`, stock: 5, productCode: `T-${marker}` }],
    sales: [],
    stockMovements: [],
    customers: [],
    expenses: [],
    settings: {
      businessName,
      storeName: businessName,
      lowStockThreshold: 10,
      defaultPriceType: 'retail',
      /** Test harness: irsaliye migrasyonu main yazmayı ezmesin */
      productProfile: 'pos-lite',
    },
    priceType: 'retail',
    users: businessName.includes('Lima')
      ? [adminUser('limaadmin', 'Lima Admin')]
      : [adminUser('kutluhan08', 'Kutluhan'), adminUser('yonetici', 'Platform')],
  };
}

// --- Unit: tenant guards ---
const greenleafBulk = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, name: `G${i}`, stock: 1 }));
const limaClean = [{ id: 1001, name: 'Lima Soap', stock: 2 }];
let guarded = guardIsolatedTenantStoreWrite('lima-market', { products: limaClean }, {
  products: greenleafBulk,
  users: [{ username: 'yonetici' }, { username: 'limaadmin' }],
});
assert.equal(guarded.products.length, 1, 'Lima: Greenleaf bulk yazılamaz');
assert.ok(!guarded.users.some((u) => u.username === 'yonetici'), 'Lima: yeni yonetici eklenemez');

const readSan = sanitizeIsolatedTenantStoreRead('lima-market', { products: greenleafBulk });
assert.equal(readSan.products.length, 0, 'Lima GET: Greenleaf bulk okunamaz');

assert.equal(assertTenantStoreWriteAllowed('kutluhan08', 'main').ok, true);
assert.equal(assertTenantStoreWriteAllowed('kutluhan08', 'lima-market').ok, false);
assert.equal(assertTenantStoreWriteAllowed('yonetici', 'lima-market').ok, true);

console.log('OK    guard birim testleri (izolasyon + yazma politikası)');

// --- Integration: HTTP + ayrı dosyalar ---
const dataDir = await mkdtemp(join(tmpdir(), 'mt-pos-'));
await mkdir(join(dataDir, 'tenants', 'lima-market'), { recursive: true });
await writeTenantStore(dataDir, 'main', minimalStore('Greenleaf Market', 1));
await writeTenantStore(dataDir, 'lima-market', minimalStore('Lima Market', 1001));

const mainDisk = await readTenantStore(dataDir, 'main');
const limaDisk = await readTenantStore(dataDir, 'lima-market');
assert.notEqual(mainDisk.products[0].id, limaDisk.products[0].id, 'Disk: ayrı store dosyaları');

const server = spawn(process.execPath, ['server.mjs'], {
  cwd: REPO,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', MARKET_POS_DATA_DIR: dataDir },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitHealth() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/email/health`);
      if (r.ok) return true;
    } catch {
      /* */
    }
    await sleep(300);
  }
  return false;
}

if (!(await waitHealth())) {
  server.kill();
  throw new Error('Test server başlamadı');
}

async function posToken(tenant, username, password) {
  const q = tenant === 'main' ? '' : `?tenant=${encodeURIComponent(tenant)}`;
  const res = await fetch(`${BASE}/api/auth/pos-token${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(res.status, 200, `login ${tenant}/${username}`);
  const j = await res.json();
  return j.token;
}

const mainToken = await posToken('main', 'kutluhan08', 'TestPass123!');
const limaToken = await posToken('lima-market', 'limaadmin', 'TestPass123!');

async function getStore(tenant, token) {
  const q = tenant === 'main' ? '' : `?tenant=${encodeURIComponent(tenant)}`;
  const res = await fetch(`${BASE}/api/data${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, json: res.ok ? await res.json() : null };
}

const gMain = await getStore('main', mainToken);
assert.equal(gMain.json.products[0].id, 1, 'main veri okundu');
const gLima = await getStore('lima-market', limaToken);
assert.equal(gLima.json.products[0].id, 1001, 'lima veri okundu');

const cross = await getStore('lima-market', mainToken);
assert.equal(cross.status, 403, 'main token lima verisine erişemez');

const cross2 = await getStore('main', limaToken);
assert.equal(cross2.status, 403, 'lima token main verisine erişemez');

async function putStore(tenant, token, snapshot) {
  const q = tenant === 'main' ? '' : `?tenant=${encodeURIComponent(tenant)}`;
  const res = await fetch(`${BASE}/api/data${q}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(snapshot),
  });
  return res.status;
}

const mainMarker = `Greenleaf smoke ${Date.now()}`;
const mainSnap = {
  ...mainDisk,
  updatedAt: new Date().toISOString(),
  settings: { ...mainDisk.settings, businessName: mainMarker },
};
assert.equal(await putStore('main', mainToken, mainSnap), 200, 'kutluhan main PUT');

const limaMarker = `Lima smoke ${Date.now()}`;
const limaSnap = {
  ...limaDisk,
  updatedAt: new Date().toISOString(),
  products: [{ id: 1001, name: limaMarker, stock: 77, productCode: 'T-1001' }],
};
assert.equal(await putStore('lima-market', limaToken, limaSnap), 200, 'limaadmin lima PUT');

const kutluhanLimaPut = await putStore('lima-market', mainToken, limaSnap);
assert.equal(kutluhanLimaPut, 403, 'kutluhan08 lima PUT engelli');

const gMainAfter = await getStore('main', mainToken);
assert.equal(gMainAfter.json.settings.businessName, mainMarker, 'main ayar sunucuya yazıldı (GET)');
const gLimaAfter = await getStore('lima-market', limaToken);
assert.equal(gLimaAfter.json.products[0].name, limaMarker, 'lima ürün sunucuya yazıldı (GET)');

const autoDir = join(dataDir, 'backups', 'auto-tenant', 'lima-market');
const autoFiles = await readdir(autoDir);
assert.ok(autoFiles.some((f) => f.startsWith('store-') && f.endsWith('.json')), 'sunucu otomatik tenant yedek');

console.log('OK    HTTP tenant izolasyonu + ayrı PUT + kutluhan lima engeli + auto-backup');

server.kill();
console.log('\nmulti-tenant data safety smoke: PASS');
