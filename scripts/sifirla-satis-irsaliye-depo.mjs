#!/usr/bin/env node
/**
 * Tüm satışları siler, stokları LUY2026000000002 irsaliyesine birebir yazar.
 *
 * Yerel data:
 *   node scripts/sifirla-satis-irsaliye-depo.mjs ./data
 *
 * Canlı (dikkat):
 *   POS_URL=https://ekolojikmarket.com.tr node scripts/sifirla-satis-irsaliye-depo.mjs --remote
 *
 * Önce yedek alın. Tüm POS sekmelerini kapatın; işlem bitince tek sekme Ctrl+F5.
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';
import { resetStoreToIrsaliyeWarehouse } from '../server/warehouseReset.mjs';

const dataDirArg = process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]);
const dataDir = dataDirArg || join(process.cwd(), 'data');
const remote = process.argv.includes('--remote');
const dryRun = process.argv.includes('--dry-run');
const baseUrl = (process.env.POS_URL || 'https://ekolojikmarket.com.tr').replace(/\/$/, '');

function sumStock(products) {
  return (products ?? []).reduce((s, p) => s + (p.stock ?? 0), 0);
}

async function resetLocalTenant(tenantId) {
  const snapshot = await readTenantStore(dataDir, tenantId);
  if (!snapshot?.products?.length) {
    console.log(`  ${tenantId}: ürün yok, atlandı`);
    return;
  }
  const beforeSales = snapshot.sales?.length ?? 0;
  const beforeStock = sumStock(snapshot.products);
  const next = resetStoreToIrsaliyeWarehouse(snapshot);
  const afterStock = sumStock(next.products);
  console.log(
    `  ${tenantId}: satış ${beforeSales}→0, stok ${beforeStock}→${afterStock}, hareket ${snapshot.stockMovements?.length ?? 0}→0`,
  );
  if (!dryRun) {
    await writeTenantStore(dataDir, tenantId, next);
  }
}

async function resetRemote() {
  const res = await fetch(`${baseUrl}/api/data`);
  if (!res.ok) {
    throw new Error(`GET /api/data ${res.status}`);
  }
  const snapshot = await res.json();
  const next = resetStoreToIrsaliyeWarehouse(snapshot);
  console.log(
    `Uzak: satış ${snapshot.sales?.length ?? 0}→0, stok ${sumStock(snapshot.products)}→${sumStock(next.products)}`,
  );
  if (dryRun) {
    console.log('Dry-run — PUT yapılmadı');
    return;
  }
  const put = await fetch(`${baseUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  });
  const body = await put.text();
  if (!put.ok) {
    throw new Error(`PUT ${put.status} ${body}`);
  }
  console.log('PUT OK', body);
  const verify = await fetch(`${baseUrl}/api/data`);
  const data = await verify.json();
  console.log('Doğrulama — satış:', data.sales?.length ?? 0, 'toplam stok:', sumStock(data.products));
}

async function main() {
  if (remote) {
    console.log(`==> Uzak depo sıfırlama: ${baseUrl}`);
    await resetRemote();
    return;
  }
  console.log(`==> Yerel depo sıfırlama: ${dataDir}`);
  await resetLocalTenant('main');
  const tenantsDir = join(dataDir, 'tenants');
  try {
    const entries = await readdir(tenantsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) await resetLocalTenant(entry.name);
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
