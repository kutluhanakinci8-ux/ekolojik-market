#!/usr/bin/env node
/**
 * Satışı tamamen nakit olarak işaretler.
 *   node scripts/patch-sale-payment-cash.mjs S1792511173681
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [saleId] = process.argv.slice(2);
if (!saleId) {
  console.error('Kullanım: node scripts/patch-sale-payment-cash.mjs <saleId>');
  process.exit(1);
}

const dataDir = process.env.MARKET_POS_DATA_DIR?.trim() || join(process.cwd(), 'data');
const storePath = join(dataDir, 'store.json');

const raw = JSON.parse(await readFile(storePath, 'utf8'));
const sales = raw.sales ?? [];
const idx = sales.findIndex((s) => s.id === saleId);
if (idx < 0) {
  console.error('Satış bulunamadı:', saleId);
  process.exit(1);
}
const sale = sales[idx];
const total = Math.round(Number(sale.total) * 100) / 100;

sales[idx] = {
  ...sale,
  paymentMethod: 'cash',
  paymentSplits: undefined,
  cashTendered: total,
  changeGiven: 0,
  paymentCorrectedAt: new Date().toISOString(),
  paymentCorrectionNote: 'Nakit düzeltme (patch-sale-payment-cash)',
};

await writeFile(storePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log('OK', saleId, 'cash', total);
