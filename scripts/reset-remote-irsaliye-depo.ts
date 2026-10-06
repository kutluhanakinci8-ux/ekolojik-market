#!/usr/bin/env npx tsx
/**
 * Canlı /api/data: satışları sil, stokları LUY irsaliyesine yazar (35 stok kodu / 1332 adet; 136 katalog kartı).
 *   POS_URL=https://ekolojikmarket.com.tr npx tsx scripts/reset-remote-irsaliye-depo.ts
 *   --dry-run
 */
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resetStoreToIrsaliyeWarehouse } from '../src/utils/warehouseReset.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const baseUrl = (process.env.POS_URL || 'https://ekolojikmarket.com.tr').replace(/\/$/, '');
const dryRun = process.argv.includes('--dry-run');

async function loadTs(path: string) {
  return import(pathToFileURL(path).href);
}

async function buildCatalogProducts() {
  const { SEED_PRODUCTS } = await loadTs(join(root, 'src/data/seedProducts.ts'));
  const { GREENLEAF_PRODUCTS } = await loadTs(join(root, 'src/data/greenleafCatalog.ts'));
  const { PRODUCT_CATEGORIES } = await loadTs(join(root, 'src/data/categories.ts'));
  const { PRICE_BATCH_1_BY_PRODUCT_ID } = await loadTs(join(root, 'src/data/priceCatalogBatch1.ts'));
  const { applyCatalogPricing } = await loadTs(join(root, 'src/utils/productPricing.ts'));
  const { resolveWarehouseStockForProduct } = await loadTs(join(root, 'src/utils/applyIrsaliyeStock.ts'));
  const { irsaliyeEanForCode } = await loadTs(join(root, 'src/data/irsaliyeLuy2026000000002.ts'));

  const seeds = [
    ...SEED_PRODUCTS.map((s: { id: number }) => ({
      ...s,
      category: PRODUCT_CATEGORIES[s.id] ?? 'kisisel-bakim',
    })),
    ...GREENLEAF_PRODUCTS,
  ];

  return seeds.map((seed: { id: number; productCode?: string; barcode?: string }) => {
    const catalogEntry = PRICE_BATCH_1_BY_PRODUCT_ID[seed.id];
    const priced = catalogEntry ? applyCatalogPricing(seed, catalogEntry) : seed;
    const productCode = priced.productCode;
    const ean = catalogEntry ? irsaliyeEanForCode(catalogEntry.code) : irsaliyeEanForCode(productCode);
    const stock = resolveWarehouseStockForProduct({
      id: seed.id,
      productCode,
      barcode: priced.barcode,
    });
    return {
      ...priced,
      stock,
      productCode,
      barcode: ean ?? priced.barcode ?? productCode,
    };
  });
}

async function main() {
  const res = await fetch(`${baseUrl}/api/data`);
  if (!res.ok) throw new Error(`GET ${res.status}`);
  const remote = (await res.json()) as Record<string, unknown>;

  const catalogProducts = await buildCatalogProducts();
  const totalTarget = catalogProducts.reduce((s, p) => s + p.stock, 0);

  const snapshot = resetStoreToIrsaliyeWarehouse(
    {
      ...(remote as import('../src/types/persistedStore.ts').PersistedStoreSnapshot),
      products: catalogProducts,
    },
    catalogProducts,
  );

  console.log(
    `İrsaliye: 39 satır, 35 stok kodu, ${totalTarget} adet | Katalog kartı: ${catalogProducts.length} | Satış ${(remote.sales as unknown[])?.length ?? 0}→0`,
  );

  if (dryRun) {
    console.log('Dry-run — PUT yok');
    return;
  }

  const put = await fetch(`${baseUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snapshot),
  });
  const body = await put.text();
  if (!put.ok) throw new Error(`PUT ${put.status} ${body}`);
  console.log('PUT OK');

  const verify = await fetch(`${baseUrl}/api/data`);
  const data = (await verify.json()) as { sales?: unknown[]; products?: { stock: number }[] };
  const sum = (data.products ?? []).reduce((s, p) => s + (p.stock ?? 0), 0);
  console.log('Doğrulama — satış:', data.sales?.length ?? 0, 'stok toplam:', sum, 'ürün:', data.products?.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
