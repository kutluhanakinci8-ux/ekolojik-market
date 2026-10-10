#!/usr/bin/env node
/**
 * Lima / POS Lite — tenant guard + fiş ayarı birim testleri
 */
import assert from 'node:assert/strict';
import { guardIsolatedTenantStoreWrite } from '../../server/tenantStoreGuard.mjs';

let failed = 0;

function ok(name) {
  console.log(`  ok  ${name}`);
}

function bad(name, err) {
  console.error(`  FAIL ${name}:`, err instanceof Error ? err.message : err);
  failed += 1;
}

function test(name, fn) {
  try {
    fn();
    ok(name);
  } catch (e) {
    bad(name, e);
  }
}

const limaBase = {
  settings: { productProfile: 'pos-lite', businessName: 'Lima Market' },
  users: [{ id: '1', username: 'limaadmin' }],
  products: [{ id: 'p1', name: 'Test' }],
};

test('guard: yonetici lima-market’e eklenemez', () => {
  const out = guardIsolatedTenantStoreWrite('lima-market', limaBase, {
    ...limaBase,
    users: [...limaBase.users, { id: 'x', username: 'yonetici' }],
  });
  assert.ok(!out.users.some((u) => u.username === 'yonetici'));
});

test('guard: 30+ ürün toplu yazımı engellenir (boş katalog)', () => {
  const out = guardIsolatedTenantStoreWrite('lima-market', { ...limaBase, products: [] }, {
    ...limaBase,
    products: Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, name: `U${i}` })),
  });
  assert.equal(out.products.length, 0);
});

test('guard: mevcut lima ürünleri korunur', () => {
  const out = guardIsolatedTenantStoreWrite('lima-market', limaBase, {
    ...limaBase,
    products: [...limaBase.products, { id: 'p2', name: 'Yeni' }],
  });
  assert.equal(out.products.length, 2);
});

test('guard: pos-lite receiptPrinter sunucuya yazılmaz', () => {
  const out = guardIsolatedTenantStoreWrite('lima-market', limaBase, {
    ...limaBase,
    settings: {
      ...limaBase.settings,
      receiptPrinter: { enabled: true, brand: 'zywell', paperWidthMm: 80 },
    },
  });
  assert.equal(out.settings.receiptPrinter, undefined);
});

test('guard: main tenant etkilenmez', () => {
  const main = { settings: { productProfile: 'full' }, users: [{ username: 'yonetici' }] };
  const out = guardIsolatedTenantStoreWrite('main', main, {
    ...main,
    users: [...main.users, { username: 'kasiyer' }],
  });
  assert.equal(out.users.length, 2);
});

if (failed > 0) {
  console.error(`\nLima POS unit: ${failed} failed`);
  process.exit(1);
}
console.log('\nLima POS unit: PASS');
