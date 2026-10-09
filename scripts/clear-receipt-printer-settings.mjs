#!/usr/bin/env node
/**
 * Sunucudaki receiptPrinter kaydını kaldır — Greenleaf kasa (HTML/Chrome) yolu geri gelir.
 *   node scripts/clear-receipt-printer-settings.mjs --data-dir /var/www/market-pos/data
 *   node scripts/clear-receipt-printer-settings.mjs --data-dir ./data --tenant lima-market
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'all';

function storePath(id) {
  return id === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', id, 'store.json');
}

const tenants =
  tenant === 'all' ? ['main', 'lima-market'] : [tenant];

for (const id of tenants) {
  const path = storePath(id);
  const store = JSON.parse(await readFile(path, 'utf8'));
  if (store.settings?.receiptPrinter) {
    delete store.settings.receiptPrinter;
    store.updatedAt = new Date().toISOString();
    await writeFile(path, JSON.stringify(store, null, 2));
    console.log(`OK   ${id}: receiptPrinter kaldırıldı (Greenleaf kasa yolu)`);
  } else {
    console.log(`—    ${id}: zaten yok`);
  }
}
