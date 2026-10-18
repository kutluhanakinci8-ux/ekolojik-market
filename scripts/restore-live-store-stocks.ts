#!/usr/bin/env node
/**
 * Canlı POS /api/data store.json — ürün stoklarını LUY2026000000002 irsaliyesine göre yazar.
 * Mevcut satış/müşteri vb. alanları korur (sadece products + updatedAt güncellenir).
 *
 * Kullanım:
 *   POS_URL=https://ekolojikmarket.com.tr npx tsx scripts/restore-live-store-stocks.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';
import { applyIrsaliyeStockToStoreSnapshot, resolveWarehouseStock, resolveProductStockCode } from '../server/irsaliyeStock.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const baseUrl = (process.env.POS_URL || 'https://ekolojikmarket.com.tr').replace(/\/$/, '');

async function loadTs(path: string) {
  return import(pathToFileURL(path).href);
}

async function buildCatalogProducts() {
  const { SEED_PRODUCTS } = await loadTs(join(root, 'src/data/seedProducts.ts'));
  const { GREENLEAF_PRODUCTS } = await loadTs(join(root, 'src/data/greenleafCatalog.ts'));
  const { PRODUCT_CATEGORIES } = await loadTs(join(root, 'src/data/categories.ts'));
  const { PRICE_BATCH_1_BY_PRODUCT_ID } = await loadTs(join(root, 'src/data/priceCatalogBatch1.ts'));
  const { applyCatalogPricing } = await loadTs(join(root, 'src/utils/productPricing.ts'));

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
    const productCode = catalogEntry ? priced.productCode : priced.productCode;
    const barcode = catalogEntry?.code ?? priced.barcode ?? productCode;
    const stock = resolveWarehouseStock(seed.id, productCode, barcode);
    const code = resolveProductStockCode(seed.id, productCode, barcode);
    return {
      ...priced,
      stock,
      productCode: productCode || code,
      barcode: barcode || code,
    };
  });
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  let remote: Record<string, unknown> = {};
  try {
    const res = await fetch(`${baseUrl}/api/data`);
    if (res.ok) {
      remote = (await res.json()) as Record<string, unknown>;
    }
  } catch (error) {
    console.warn('Uzak store okunamadı:', error);
  }

  const catalogProducts = await buildCatalogProducts();
  const { snapshot: migrated } = applyIrsaliyeStockToStoreSnapshot({
    products: catalogProducts,
    updatedAt: new Date().toISOString(),
  });

  const remoteProducts = Array.isArray(remote.products) ? remote.products : [];
  const remoteById = new Map(remoteProducts.map((p: { id: number }) => [p.id, p]));

  const mergedProducts = migrated.products!.map((cat) => {
    const saved = remoteById.get(cat.id) as Record<string, unknown> | undefined;
    if (!saved) return cat;
    return {
      ...saved,
      ...cat,
      stock: cat.stock,
      productCode: cat.productCode ?? saved.productCode,
      barcode: cat.barcode ?? saved.barcode,
      purchasePrice: cat.purchasePrice ?? saved.purchasePrice,
      partnerPrice: cat.partnerPrice ?? saved.partnerPrice,
      fullSalePrice: cat.fullSalePrice ?? saved.fullSalePrice,
    };
  });

  const nextSnapshot = {
    ...remote,
    products: mergedProducts,
    updatedAt: new Date().toISOString(),
  };

  const total = mergedProducts.reduce((s, p) => s + (p.stock ?? 0), 0);
  console.log(`Hedef toplam stok: ${total} (${mergedProducts.length} ürün)`);

  const outPath = '/tmp/ekolojik-store-payload.json';
  writeFileSync(outPath, JSON.stringify(nextSnapshot));

  if (dryRun) {
    console.log('Dry-run — yazılmadı:', outPath);
    return;
  }

  const putRes = await fetch(`${baseUrl}/api/data`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(nextSnapshot),
  });
  const putBody = await putRes.text();
  if (!putRes.ok) {
    console.error('PUT hatası', putRes.status, putBody);
    process.exit(1);
  }
  console.log('PUT OK', putBody);

  const verify = await fetch(`${baseUrl}/api/data`);
  const data = (await verify.json()) as { products?: { stock: number }[] };
  const verifyTotal = (data.products ?? []).reduce((s, p) => s + (p.stock ?? 0), 0);
  console.log('Doğrulama toplam stok:', verifyTotal);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
