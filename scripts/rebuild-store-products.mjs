#!/usr/bin/env node
/** Canlı store.json products dizisini katalog + irsaliye stoklarıyla üretir */
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Vite build sonrası dist kullanılmıyor — irsaliyeStock + manuel seed sayısı
import { applyIrsaliyeStockToStoreSnapshot, resolveWarehouseStock, resolveProductStockCode } from '../server/irsaliyeStock.mjs';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

// seedProducts.ts ve greenleafCatalog.ts yerine dist bundle'dan okuyamayız;
// store API'den kaybolan veri için: npm run build && node scripts/export-default-products.mjs eklenecek
// Şimdilik: tsx ile TS modülleri yükle
const { pathToFileURL } = await import('node:url');

async function loadTs(path) {
  return import(pathToFileURL(path).href);
}

const { SEED_PRODUCTS } = await loadTs(join(root, 'src/data/seedProducts.ts'));
const { GREENLEAF_PRODUCTS } = await loadTs(join(root, 'src/data/greenleafCatalog.ts'));
const { PRODUCT_CATEGORIES } = await loadTs(join(root, 'src/data/categories.ts'));
const { PRICE_BATCH_1_BY_PRODUCT_ID } = await loadTs(join(root, 'src/data/priceCatalogBatch1.ts'));
const { applyCatalogPricing } = await loadTs(join(root, 'src/utils/productPricing.ts'));

const seeds = [
  ...SEED_PRODUCTS.map((s) => ({
    ...s,
    category: PRODUCT_CATEGORIES[s.id] ?? 'kisisel-bakim',
  })),
  ...GREENLEAF_PRODUCTS,
];

const products = seeds.map((seed) => {
  const catalogEntry = PRICE_BATCH_1_BY_PRODUCT_ID[seed.id];
  const priced = catalogEntry ? applyCatalogPricing(seed, catalogEntry) : seed;
  const productCode = catalogEntry ? priced.productCode : priced.productCode;
  const barcode = catalogEntry?.code ?? priced.barcode ?? productCode;
  const stock = resolveWarehouseStock(seed.id, productCode, barcode);
  return {
    ...priced,
    stock,
    productCode: productCode || resolveProductStockCode(seed.id, productCode, barcode),
    barcode: barcode || resolveProductStockCode(seed.id, productCode, barcode),
  };
});

const { snapshot } = applyIrsaliyeStockToStoreSnapshot({ products, updatedAt: new Date().toISOString() });
const out = process.argv[2] || join(root, 'data/rebuilt-products-only.json');
writeFileSync(out, JSON.stringify(snapshot.products, null, 2));
const total = snapshot.products.reduce((s, p) => s + p.stock, 0);
console.log(`Wrote ${snapshot.products.length} products, total stock ${total} -> ${out}`);
