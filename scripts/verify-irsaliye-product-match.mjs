#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { IRSALIYE_STOCK_BY_CODE } from '../server/irsaliyeStock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

async function loadTs(path) {
  return import(pathToFileURL(path).href);
}

const { PRICE_BATCH_1_BY_PRODUCT_ID } = await loadTs(join(root, 'src/data/priceCatalogBatch1.ts'));
const { SEED_PRODUCTS } = await loadTs(join(root, 'src/data/seedProducts.ts'));

let total = 0;
console.log('ID\tKod\tİrsaliye adet\tÜrün');
for (const [idStr, entry] of Object.entries(PRICE_BATCH_1_BY_PRODUCT_ID)) {
  const id = Number(idStr);
  const seed = SEED_PRODUCTS.find((p) => p.id === id);
  const qty = IRSALIYE_STOCK_BY_CODE[entry.code];
  const adet = qty ?? 0;
  total += adet;
  console.log(`${id}\t${entry.code}\t${adet}\t${(seed?.name ?? entry.name).slice(0, 55)}`);
}

console.log('---');
console.log('Toplam irsaliye adet (batch-1 eşleşen):', total);
