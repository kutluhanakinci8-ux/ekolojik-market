#!/usr/bin/env node
/**
 * Satış geçmişini temizle (stok adetlerine dokunmaz). Çoklu ekran senkronu için temiz başlangıç.
 *
 *   node scripts/clear-tenant-sales-history.mjs --data-dir /var/www/market-pos/data --tenant main
 *   node scripts/clear-tenant-sales-history.mjs --dry-run
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dryRun = process.argv.includes('--dry-run');
const allTenants = process.argv.includes('--all-tenants');
const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'main';

async function clearOneStore(storePath, tenantLabel) {
  const raw = await readFile(storePath, 'utf8');
  const store = JSON.parse(raw);
  const before = {
    sales: store.sales?.length ?? 0,
    returns: store.saleReturns?.length ?? 0,
    movements: store.stockMovements?.length ?? 0,
  };

  const now = new Date();
  const businessDate = now.toISOString().slice(0, 10);
  const clearedAt = now.toISOString();

  store.sales = [];
  store.saleReturns = [];
  store.stockMovements = [];
  store.customerLedger = [];
  store.cashHandovers = [];
  store.cashSessions = [
    {
      date: businessDate,
      openingBalance: 0,
      createdAt: clearedAt,
    },
  ];
  store.settings = {
    ...(store.settings ?? {}),
    salesHistoryClearedAt: clearedAt,
  };
  store.updatedAt = clearedAt;

  console.log(`\nTenant: ${tenantLabel}`);
  console.log(`Önce: ${before.sales} satış, ${before.returns} iade, ${before.movements} stok hareketi`);
  console.log(`Ürün kartı: ${store.products?.length ?? 0} (stok adetleri korunur)`);
  console.log(`salesHistoryClearedAt: ${clearedAt}`);

  if (dryRun) return;

  const backupDir = join(dataDir, 'data-backups');
  await mkdir(backupDir, { recursive: true });
  const stamp = clearedAt.replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `pre-sales-clear-${tenantLabel}-${stamp}.json`);
  await copyFile(storePath, backupPath);
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  console.log(`Yedek: ${backupPath}`);
}

const targets = [];
if (allTenants) {
  targets.push({ path: join(dataDir, 'store.json'), label: 'main' });
  const tenantsDir = join(dataDir, 'tenants');
  try {
    for (const name of await readdir(tenantsDir)) {
      targets.push({ path: join(tenantsDir, name, 'store.json'), label: name });
    }
  } catch {
    /* no tenants dir */
  }
} else {
  targets.push({
    path: tenant === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', tenant, 'store.json'),
    label: tenant,
  });
}

for (const t of targets) {
  await clearOneStore(t.path, t.label);
}

if (dryRun) {
  console.log('\nDRY RUN — dosya yazılmadı.');
} else {
  console.log('\nTamam — satış geçmişi silindi; eski satışlar istemciden geri yazılamaz.');
}
