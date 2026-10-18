#!/usr/bin/env node
/**
 * KLA128 (10’lu paket, id 8) → tekli sanal stok KLA128T (id 138).
 * Stok: paket adedi × 10. Perakende KDV dahil 188 ₺. Barkod paket ile aynı (6955470959966).
 *
 * Kullanım: node scripts/sync-kla128-unit-virtual-stock.mjs [/var/www/market-pos/data]
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';

const PACK_PRODUCT_ID = 8;
const UNIT_PRODUCT_ID = 138;
const UNIT_CODE = 'KLA128T';
const UNIT_BARCODE = '6955470959966';
const RETAIL_GROSS = 188;
const RETAIL_NET = 156.67;
const PURCHASE_UNIT = 26.63;
const TARGET_TENANTS = new Set(['main']);

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function partnerFromRetailNet(net) {
  return round2(net / 2);
}

function buildUnitProduct(pack, existing) {
  const packStock = Math.max(0, Math.floor(Number(pack?.stock) || 0));
  const unitStock = packStock * 10;
  const partner = partnerFromRetailNet(RETAIL_NET);
  const partnerGross = round2(partner * 1.2);

  const base = existing ?? {
    id: UNIT_PRODUCT_ID,
    name: 'CARICH Doğal Ağartılmamış Bambu Lifinden Kağıt Mendil (tek adet)',
    category: pack?.category ?? 'kagit-mendil',
    pv: 0.02,
    boxDimensions: '-',
    weightKg: 0,
    desi: 0,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    imageUrl: pack?.imageUrl,
  };

  return {
    ...base,
    id: UNIT_PRODUCT_ID,
    productCode: UNIT_CODE,
    barcode: UNIT_BARCODE,
    stock: unitStock,
    purchasePrice: PURCHASE_UNIT,
    partnerPrice: partner,
    couponPrice: partner,
    fullSalePrice: RETAIL_NET,
    ourPriceWithVat: RETAIL_GROSS,
    partnerPriceWithVat: partnerGross,
    ourPercent: PURCHASE_UNIT > 0
      ? Math.round(((RETAIL_NET - PURCHASE_UNIT) / PURCHASE_UNIT) * 100)
      : base.ourPercent ?? 0,
    pricingUpdatedAt: new Date().toISOString(),
    virtualPackProductId: PACK_PRODUCT_ID,
  };
}

function migrateStore(snapshot) {
  const products = [...(snapshot.products ?? [])];
  const packIdx = products.findIndex((p) => Number(p.id) === PACK_PRODUCT_ID);
  if (packIdx < 0) {
    return { snapshot, changed: false, report: ['  paket ürün KLA128 (id 8) bulunamadı — atlandı'] };
  }

  const pack = products[packIdx];
  const packBarcode = 'KLA128';
  let packChanged = false;
  if (pack.barcode !== packBarcode || pack.productCode !== packBarcode) {
    products[packIdx] = {
      ...pack,
      productCode: packBarcode,
      barcode: packBarcode,
    };
    packChanged = true;
  }

  const unitIdx = products.findIndex((p) => Number(p.id) === UNIT_PRODUCT_ID);
  const rebuilt = buildUnitProduct(products[packIdx], unitIdx >= 0 ? products[unitIdx] : undefined);

  const report = [];
  let unitChanged = false;
  if (unitIdx >= 0) {
    const prev = products[unitIdx];
    const stockChanged = prev.stock !== rebuilt.stock;
    const priceChanged =
      prev.ourPriceWithVat !== rebuilt.ourPriceWithVat
      || prev.fullSalePrice !== rebuilt.fullSalePrice
      || prev.barcode !== rebuilt.barcode;
    if (stockChanged || priceChanged || prev.productCode !== UNIT_CODE) {
      products[unitIdx] = rebuilt;
      unitChanged = true;
      report.push(
        `  güncellendi: KLA128T stok ${rebuilt.stock} (paket ${products[packIdx].stock}×10), barkod ${UNIT_BARCODE}`,
      );
    }
  } else {
    products.push(rebuilt);
    unitChanged = true;
    report.push(
      `  eklendi: KLA128T stok ${rebuilt.stock} (paket ${products[packIdx].stock}×10), perakende ${RETAIL_GROSS} ₺ KDV dahil`,
    );
  }

  if (packChanged) {
    report.push(`  paket KLA128 barkod → ${packBarcode} (EAN yalnızca tekli)`);
  }

  if (!packChanged && !unitChanged) {
    report.push(`  uyumlu: KLA128 paket barkod ${packBarcode}, KLA128T stok ${rebuilt.stock}`);
    return { snapshot, changed: false, report };
  }

  return {
    snapshot: {
      ...snapshot,
      products,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
    report,
  };
}

async function migrateTenant(dataDir, tenantId) {
  if (!TARGET_TENANTS.has(tenantId)) return;
  const snapshot = await readTenantStore(dataDir, tenantId);
  const { snapshot: next, changed, report } = migrateStore(snapshot);
  for (const line of report) console.log(`  ${tenantId}:${line}`);
  if (!changed) return;
  await writeTenantStore(dataDir, tenantId, next);
}

async function main() {
  const dataDir = process.argv[2] || join(process.cwd(), 'data');
  console.log(`==> KLA128 tekli sanal stok: ${dataDir}`);
  const entries = await readdir(dataDir, { withFileTypes: true });
  const tenants = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name);
  for (const tenantId of tenants) {
    await migrateTenant(dataDir, tenantId);
  }
  console.log('==> Bitti');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
