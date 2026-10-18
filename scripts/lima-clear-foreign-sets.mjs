#!/usr/bin/env node
/** Canlı lima-market: Greenleaf setlerini temizle (ürün listesine dokunmaz) */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { filterProductSetsForCatalog } from '../server/tenantStoreGuard.mjs';

const dataDir = process.argv[2] || '/var/www/market-pos/data';
const path = join(dataDir, 'tenants', 'lima-market', 'store.json');

const store = JSON.parse(await readFile(path, 'utf8'));
const before = store.productSets?.length ?? 0;
const kept = filterProductSetsForCatalog(store.products, store.productSets);
store.productSets = kept;
store.updatedAt = new Date().toISOString();
await writeFile(path, JSON.stringify(store, null, 2));
console.log(`OK lima-market productSets: ${before} → ${kept.length}`);
