#!/usr/bin/env node
/**
 * Fiş yazıcı ayarını main → POS Lite tenant kopyala (Zywell varsayılanı)
 *
 *   node scripts/sync-receipt-printer-tenants.mjs --data-dir /var/www/market-pos/data
 *   node scripts/sync-receipt-printer-tenants.mjs --data-dir ./data --source main --target lima-market
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ZYWELL_PRESET = {
  enabled: true,
  brand: 'zywell',
  windowsPrinterName: 'Zywell',
  paperWidthMm: 80,
  autoPrintOnSale: true,
  copies: 1,
  printMode: 'plain',
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const sourceTenant = arg('source') || 'main';
const targetTenant = arg('target') || 'lima-market';

function storePath(tenant) {
  return tenant === 'main'
    ? join(dataDir, 'store.json')
    : join(dataDir, 'tenants', tenant, 'store.json');
}

const sourcePath = storePath(sourceTenant);
const targetPath = storePath(targetTenant);

const sourceStore = JSON.parse(await readFile(sourcePath, 'utf8'));
const targetStore = JSON.parse(await readFile(targetPath, 'utf8'));

const sourcePrinter =
  sourceStore.settings?.receiptPrinter
  ?? (sourceTenant === 'main' ? ZYWELL_PRESET : null)
  ?? ZYWELL_PRESET;

if (!sourceStore.settings?.receiptPrinter && sourceTenant === 'main') {
  sourceStore.settings = { ...(sourceStore.settings ?? {}), receiptPrinter: sourcePrinter };
  sourceStore.updatedAt = new Date().toISOString();
  await writeFile(sourcePath, JSON.stringify(sourceStore, null, 2));
  console.log(`OK   ${sourceTenant}: Zywell fiş yazıcı ayarı yazıldı`);
}

const mergedPrinter = { ...ZYWELL_PRESET, ...sourcePrinter, printMode: sourcePrinter.printMode ?? ZYWELL_PRESET.printMode };
targetStore.settings = {
  ...(targetStore.settings ?? {}),
  receiptPrinter: mergedPrinter,
};
targetStore.updatedAt = new Date().toISOString();
await writeFile(targetPath, JSON.stringify(targetStore, null, 2));

console.log(`OK   ${targetTenant}: fiş yazıcı ayarı kopyalandı`);
console.log(JSON.stringify(targetStore.settings.receiptPrinter, null, 2));
