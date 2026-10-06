#!/usr/bin/env node
/**
 * Sunucudaki store.json (ve tenant store) ürün stoklarını LUY2026000000002 irsaliyesine göre düzeltir.
 * Kullanım: node scripts/apply-irsaliye-stock.mjs [/var/www/market-pos/data]
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';
import { applyIrsaliyeStockToStoreSnapshot } from '../server/irsaliyeStock.mjs';

const dataDir = process.argv[2] || join(process.cwd(), 'data');

async function migrateTenant(tenantId) {
  const snapshot = await readTenantStore(dataDir, tenantId);
  if (!snapshot?.products?.length) {
    console.log(`  ${tenantId}: ürün yok, atlandı`);
    return;
  }
  const { snapshot: next, changed } = applyIrsaliyeStockToStoreSnapshot(snapshot);
  if (!changed) {
    console.log(`  ${tenantId}: zaten güncel`);
    return;
  }
  await writeTenantStore(dataDir, tenantId, next);
  const totalStock = next.products.reduce((sum, p) => sum + (p.stock ?? 0), 0);
  console.log(`  ${tenantId}: güncellendi — toplam stok ${totalStock}`);
}

async function main() {
  console.log(`==> İrsaliye stok migrasyonu: ${dataDir}`);
  await migrateTenant('main');

  const tenantsDir = join(dataDir, 'tenants');
  try {
    const entries = await readdir(tenantsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await migrateTenant(entry.name);
      }
    }
  } catch {
    /* no tenants */
  }
  console.log('==> Bitti');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
