#!/usr/bin/env node
/**
 * Satış geçmişini temizle (stok adetlerine dokunmaz). Çoklu ekran senkronu için temiz başlangıç.
 *
 *   node scripts/clear-tenant-sales-history.mjs --data-dir /var/www/market-pos/data --tenant main
 *   node scripts/clear-tenant-sales-history.mjs --dry-run
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dryRun = process.argv.includes('--dry-run');
const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'main';

const storePath =
  tenant === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', tenant, 'store.json');

const raw = await readFile(storePath, 'utf8');
const store = JSON.parse(raw);
const before = {
  sales: store.sales?.length ?? 0,
  returns: store.saleReturns?.length ?? 0,
  movements: store.stockMovements?.length ?? 0,
  ledger: store.customerLedger?.length ?? 0,
  cashSessions: store.cashSessions?.length ?? 0,
};

const now = new Date();
const businessDate = now.toISOString().slice(0, 10);

store.sales = [];
store.saleReturns = [];
store.stockMovements = [];
store.customerLedger = [];
store.cashHandovers = [];
store.cashSessions = [
  {
    date: businessDate,
    openingBalance: 0,
    createdAt: now.toISOString(),
  },
];
store.updatedAt = now.toISOString();

console.log(`Tenant: ${tenant}`);
console.log(`Önce: ${before.sales} satış, ${before.returns} iade, ${before.movements} stok hareketi`);
console.log(`Ürün kartı: ${store.products?.length ?? 0} (stok adetleri korunur)`);

if (dryRun) {
  console.log('DRY RUN — dosya yazılmadı.');
  process.exit(0);
}

const backupDir = join(dataDir, 'data-backups');
await mkdir(backupDir, { recursive: true });
const stamp = now.toISOString().replace(/[:.]/g, '-');
const backupPath = join(backupDir, `pre-sales-clear-${tenant}-${stamp}.json`);
await copyFile(storePath, backupPath);
await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
console.log(`Yedek: ${backupPath}`);
console.log('Tamam — satış geçmişi silindi, yeni kasa günü açıldı (açılış 0).');
