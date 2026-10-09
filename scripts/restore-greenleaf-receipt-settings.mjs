#!/usr/bin/env node
/**
 * Greenleaf (main) kasa — çalışan fiş ayarını store.json'a yaz.
 * Gelişmiş profil KAPALI → satışta klasik HTML 80mm + iframe (yonetici yolu).
 *
 *   node scripts/restore-greenleaf-receipt-settings.mjs --data-dir /var/www/market-pos/data
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Ayarlar panelinde görünen referans; enabled:false = fiş kodu main dalı ile aynı */
export const GREENLEAF_KASA_RECEIPT_PRESET = {
  enabled: false,
  brand: 'zywell',
  windowsPrinterName: 'POS-80C',
  paperWidthMm: 80,
  pageMarginMm: 0,
  autoPrintOnSale: true,
  copies: 1,
  printMode: 'html',
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'main';

const path =
  tenant === 'main'
    ? join(dataDir, 'store.json')
    : join(dataDir, 'tenants', tenant, 'store.json');

const store = JSON.parse(await readFile(path, 'utf8'));
store.settings = {
  ...(store.settings ?? {}),
  receiptPrinter: { ...GREENLEAF_KASA_RECEIPT_PRESET },
};
store.updatedAt = new Date().toISOString();
await writeFile(path, JSON.stringify(store, null, 2));

console.log(`OK   ${tenant}: Greenleaf kasa fiş ayarı yazıldı`);
console.log(JSON.stringify(store.settings.receiptPrinter, null, 2));
