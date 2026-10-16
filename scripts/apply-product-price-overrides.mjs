#!/usr/bin/env node
/**
 * Canlı store.json üzerinde sabit perakende fiyat düzeltmeleri (deploy sonrası idempotent).
 * Kullanım: node scripts/apply-product-price-overrides.mjs [/var/www/market-pos/data]
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';
import { applyProductPricingPatch } from '../server/productPricingPatch.mjs';

/** barcode veya productCode veya productId ile eşleşir; fullSalePrice = stok ekranı perakende (₺) */
const PRICE_OVERRIDES = [
  {
    barcode: '6955470940223',
    productCode: 'CEA069',
    productId: 9,
    fullSalePrice: 641.67,
  },
];

function matchesOverride(product, rule) {
  const barcode = String(product.barcode ?? '').replace(/\s/g, '');
  if (rule.barcode && barcode === String(rule.barcode)) return true;
  if (rule.productCode && String(product.productCode ?? '') === rule.productCode) return true;
  if (rule.productId != null && Number(product.id) === Number(rule.productId)) return true;
  return false;
}

function applyOverridesToStore(snapshot) {
  if (!snapshot?.products?.length) return { snapshot, changed: false, applied: [] };

  let changed = false;
  const applied = [];
  const settings = snapshot.settings ?? {};
  const products = snapshot.products.map((product) => {
    const rule = PRICE_OVERRIDES.find((r) => matchesOverride(product, r));
    if (!rule) return product;

    const next = applyProductPricingPatch(product, { fullSalePrice: rule.fullSalePrice }, settings);
    const same =
      next.fullSalePrice === product.fullSalePrice
      && next.ourPriceWithVat === product.ourPriceWithVat;
    if (same) return product;

    changed = true;
    applied.push({
      id: product.id,
      productCode: product.productCode,
      barcode: product.barcode,
      fullSalePrice: next.fullSalePrice,
      ourPriceWithVat: next.ourPriceWithVat,
    });
    return next;
  });

  if (!changed) return { snapshot, changed: false, applied: [] };

  return {
    snapshot: {
      ...snapshot,
      products,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
    applied,
  };
}

async function migrateTenant(dataDir, tenantId) {
  const snapshot = await readTenantStore(dataDir, tenantId);
  const { snapshot: next, changed, applied } = applyOverridesToStore(snapshot);
  if (!changed) {
    console.log(`  ${tenantId}: fiyat override gerekmedi`);
    return;
  }
  await writeTenantStore(dataDir, tenantId, next);
  for (const row of applied) {
    console.log(
      `  ${tenantId}: id=${row.id} ${row.productCode} perakende=${row.fullSalePrice} ₺ (KDV dahil ${row.ourPriceWithVat} ₺)`,
    );
  }
}

async function main() {
  const dataDir = process.argv[2] || join(process.cwd(), 'data');
  console.log(`==> Ürün fiyat override: ${dataDir}`);

  await migrateTenant(dataDir, 'main');

  const tenantsDir = join(dataDir, 'tenants');
  try {
    const entries = await readdir(tenantsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await migrateTenant(dataDir, entry.name);
      }
    }
  } catch {
    /* no tenants */
  }
  console.log('==> Bitti');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
