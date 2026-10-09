#!/usr/bin/env node
/**
 * Lima Market (POS Lite) — Greenleaf (main) mağazadan ürün kopyala + stok
 *
 *   node scripts/seed-lima-demo-products.mjs --data-dir /var/www/market-pos/data
 *   node scripts/seed-lima-demo-products.mjs --data-dir ./data --source-ids 1,4,5,6
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'lima-market';
const sourceIdsRaw = arg('source-ids') || '1,4,5,6';
const sourceIds = sourceIdsRaw
  .split(',')
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n) && n > 0);

const mainPath = join(dataDir, 'store.json');
const targetPath =
  tenant === 'main' ? mainPath : join(dataDir, 'tenants', tenant, 'store.json');

const manifestPath = join(repoRoot, 'src/data/productImageManifest.json');
const imageManifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const mainStore = JSON.parse(await readFile(mainPath, 'utf8'));
const mainById = new Map((mainStore.products ?? []).map((p) => [p.id, p]));

function catalogImageForSourceId(sourceId) {
  const path = imageManifest[String(sourceId)];
  if (!path) return {};
  return { catalogImageId: sourceId, imageUrl: path };
}

const missing = sourceIds.filter((id) => !mainById.has(id));
if (missing.length) {
  console.error(`HATA  main store.json içinde bulunamayan id: ${missing.join(', ')}`);
  process.exit(1);
}

const now = new Date().toISOString();
const cloned = sourceIds.map((sourceId, index) => {
  const src = mainById.get(sourceId);
  const stock = Math.max(0, Math.floor(Number(src.stock) || 0));
  const targetId = 1001 + index;
  return {
    ...src,
    id: targetId,
    stock,
    isSample: src.isSample ?? false,
    sampleStock: src.sampleStock ?? 0,
    ...catalogImageForSourceId(sourceId),
  };
});

const targetStore = JSON.parse(await readFile(targetPath, 'utf8'));
targetStore.products = cloned;
targetStore.settings = {
  ...(targetStore.settings ?? {}),
  productProfile: targetStore.settings?.productProfile ?? 'pos-lite',
  posLiteCatalogImageByProductId: Object.fromEntries(
    cloned.map((p, i) => [String(p.id), sourceIds[i]]),
  ),
  posLiteImageUrlByProductId: Object.fromEntries(
    cloned.map((p, i) => {
      const path = imageManifest[String(sourceIds[i])];
      return path ? [String(p.id), path] : null;
    }).filter(Boolean),
  ),
};
targetStore.updatedAt = now;

const movements = cloned
  .filter((p) => p.stock > 0)
  .map((p, i) => ({
    id: `M-seed-${p.id}-${Date.now()}-${i}`,
    productId: p.id,
    productName: p.name,
    type: 'in',
    quantity: p.stock,
    previousStock: 0,
    newStock: p.stock,
    note: `Greenleaf #${sourceIds[i]} stok aktarımı (Lima POS Lite)`,
    createdAt: now,
  }));

if (movements.length) {
  const prev = Array.isArray(targetStore.stockMovements) ? targetStore.stockMovements : [];
  targetStore.stockMovements = [...movements, ...prev];
}

await writeFile(targetPath, JSON.stringify(targetStore, null, 2));

console.log(`OK   ${tenant}: ${cloned.length} ürün main mağazadan kopyalandı`);
for (let i = 0; i < cloned.length; i++) {
  const p = cloned[i];
  const srcId = sourceIds[i];
  const img = imageManifest[String(srcId)] ?? '(yok)';
  console.log(
    `     main#${srcId} → #${p.id}  ${p.barcode ?? p.productCode ?? '-'}  ${p.name?.slice(0, 50)}  stok=${p.stock}  resim=${img}`,
  );
}
