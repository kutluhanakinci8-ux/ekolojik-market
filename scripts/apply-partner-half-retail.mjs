#!/usr/bin/env node
/**
 * Tüm ürünlerde partner ve kupon = perakende (fullSalePrice) / 2
 * Kullanım: node scripts/apply-partner-half-retail.mjs [/var/www/market-pos/data]
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';
import { applyPartnerHalfRetailPricing } from '../server/productPricingPatch.mjs';

function pricingChanged(before, after) {
  return (
    before.partnerPrice !== after.partnerPrice
    || before.couponPrice !== after.couponPrice
    || before.partnerPriceWithVat !== after.partnerPriceWithVat
    || before.ourPercent !== after.ourPercent
  );
}

function applyToStore(snapshot) {
  if (!snapshot?.products?.length) return { snapshot, changed: false, count: 0 };

  const settings = snapshot.settings ?? {};
  let changed = false;
  let count = 0;
  const products = snapshot.products.map((product) => {
    const next = applyPartnerHalfRetailPricing(product, settings);
    if (!pricingChanged(product, next)) return product;
    changed = true;
    count += 1;
    return next;
  });

  if (!changed) return { snapshot, changed: false, count: 0 };

  return {
    snapshot: {
      ...snapshot,
      products,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
    count,
  };
}

async function migrateTenant(dataDir, tenantId) {
  const snapshot = await readTenantStore(dataDir, tenantId);
  const { snapshot: next, changed, count } = applyToStore(snapshot);
  if (!changed) {
    console.log(`  ${tenantId}: partner=yarı perakende zaten uyumlu`);
    return;
  }
  await writeTenantStore(dataDir, tenantId, next);
  console.log(`  ${tenantId}: ${count} ürün partner/kupon güncellendi`);
}

async function main() {
  const dataDir = process.argv[2] || join(process.cwd(), 'data');
  console.log(`==> Partner = perakende / 2: ${dataDir}`);

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
