#!/usr/bin/env node
/**
 * PDF perakende-fiyat-guncelleme (22 Ekim 2026):
 * - Partner / Kupon = yeni ortak ÷ 1,20
 * - Kasa (KDV dahil) = PDF Yeni perak.
 *
 * Kullanım: node scripts/apply-pdf-retail-update-oct2026.mjs [/var/www/market-pos/data]
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';
import { applyProductPricingPatch } from '../server/productPricingPatch.mjs';

/** productCode → { partner, coupon, kasaGross } */
const PDF_PRICE_BY_CODE = {
  DAA062: { partner: 132.92, coupon: 132.92, kasaGross: 319 },
  EAA022: { partner: 94.42, coupon: 94.42, kasaGross: 226.6 },
  CCC001: { partner: 77, coupon: 77, kasaGross: 184.8 },
  CCC029: { partner: 218.17, coupon: 218.17, kasaGross: 523.6 },
  CBB017: { partner: 88.92, coupon: 88.92, kasaGross: 213.4 },
  ASF055: { partner: 168.67, coupon: 168.67, kasaGross: 404.8 },
  ASA086: { partner: 264, coupon: 264, kasaGross: 633.6 },
  DAC056: { partner: 187, coupon: 187, kasaGross: 448.8 },
  ASF053: { partner: 202.58, coupon: 202.58, kasaGross: 486.2 },
  ASA017: { partner: 202.58, coupon: 202.58, kasaGross: 486.2 },
  ASF054: { partner: 399.67, coupon: 399.67, kasaGross: 959.2 },
  ASF066: { partner: 67.83, coupon: 67.83, kasaGross: 162.8 },
  KLA128: { partner: 352.92, coupon: 352.92, kasaGross: 847 },
  CEA069: { partner: 172.33, coupon: 172.33, kasaGross: 413.6 },
  CAA038: { partner: 271.33, coupon: 271.33, kasaGross: 651.2 },
  CAB040: { partner: 271.33, coupon: 271.33, kasaGross: 651.2 },
  DAA109: { partner: 201.67, coupon: 201.67, kasaGross: 484 },
  YBA045: { partner: 264, coupon: 264, kasaGross: 633.6 },
  DAB087: { partner: 237.42, coupon: 237.42, kasaGross: 569.8 },
  ASB044: { partner: 237.42, coupon: 237.42, kasaGross: 569.8 },
  ASB045: { partner: 120.08, coupon: 120.08, kasaGross: 288.2 },
  CBE034: { partner: 155.83, coupon: 155.83, kasaGross: 374 },
  ASB046: { partner: 132.92, coupon: 132.92, kasaGross: 319 },
  SAA069: { partner: 119.17, coupon: 119.17, kasaGross: 286 },
  CBF015: { partner: 67.83, coupon: 67.83, kasaGross: 162.8 },
  CBF014: { partner: 67.83, coupon: 67.83, kasaGross: 162.8 },
  ASB047: { partner: 220.92, coupon: 220.92, kasaGross: 530.2 },
  DAA108: { partner: 220.92, coupon: 220.92, kasaGross: 530.2 },
  CCA016: { partner: 169.58, coupon: 169.58, kasaGross: 407 },
  NWA052: { partner: 1347.5, coupon: 1347.5, kasaGross: 3234 },
  CAA039: { partner: 316.25, coupon: 316.25, kasaGross: 759 },
  CBA052: { partner: 193.42, coupon: 193.42, kasaGross: 464.2 },
  DAB089: { partner: 90.75, coupon: 90.75, kasaGross: 217.8 },
  SBJ064: { partner: 245.67, coupon: 245.67, kasaGross: 589.6 },
  EBB018: { partner: 287.83, coupon: 287.83, kasaGross: 690.8 },
  FPA151: { partner: 399.67, coupon: 399.67, kasaGross: 959.2 },
  SBC053: { partner: 373.08, coupon: 373.08, kasaGross: 895.4 },
  LGI019: { partner: 227.33, coupon: 227.33, kasaGross: 545.6 },
};

function normCode(raw) {
  return String(raw ?? '').trim().toUpperCase();
}

function pricesMatch(a, b) {
  return Math.abs(a - b) < 0.02;
}

function applyPdfPricesToStore(snapshot) {
  if (!snapshot?.products?.length) {
    return { snapshot, changed: false, applied: [], missing: Object.keys(PDF_PRICE_BY_CODE) };
  }

  const settings = snapshot.settings ?? {};
  let changed = false;
  const applied = [];
  const foundCodes = new Set();

  const products = snapshot.products.map((product) => {
    const code = normCode(product.productCode);
    const rule = PDF_PRICE_BY_CODE[code];
    if (!rule) return product;

    foundCodes.add(code);
    const next = applyProductPricingPatch(product, {
      partnerPrice: rule.partner,
      couponPrice: rule.coupon,
      ourPriceWithVat: rule.kasaGross,
    }, settings);

    const same =
      pricesMatch(next.partnerPrice ?? 0, rule.partner)
      && pricesMatch(next.couponPrice ?? 0, rule.coupon)
      && pricesMatch(next.ourPriceWithVat ?? 0, rule.kasaGross)
      && next.pricingUpdatedAt;

    if (
      pricesMatch(product.partnerPrice ?? 0, next.partnerPrice ?? 0)
      && pricesMatch(product.couponPrice ?? 0, next.couponPrice ?? 0)
      && pricesMatch(product.ourPriceWithVat ?? 0, next.ourPriceWithVat ?? 0)
      && pricesMatch(product.fullSalePrice ?? 0, next.fullSalePrice ?? 0)
    ) {
      return product;
    }

    changed = true;
    applied.push({
      id: product.id,
      code,
      partner: next.partnerPrice,
      coupon: next.couponPrice,
      kasa: next.ourPriceWithVat,
      perakende: next.fullSalePrice,
      pricingUpdatedAt: next.pricingUpdatedAt,
    });
    return next;
  });

  const missing = Object.keys(PDF_PRICE_BY_CODE).filter((c) => !foundCodes.has(c));

  if (!changed) {
    return { snapshot, changed: false, applied: [], missing, foundCodes: [...foundCodes] };
  }

  return {
    snapshot: {
      ...snapshot,
      products,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
    applied,
    missing,
    foundCodes: [...foundCodes],
  };
}

async function migrateTenant(dataDir, tenantId) {
  const snapshot = await readTenantStore(dataDir, tenantId);
  const { snapshot: next, changed, applied, missing, foundCodes } = applyPdfPricesToStore(snapshot);

  console.log(`\n--- ${tenantId} ---`);
  console.log(`  PDF kodları mağazada: ${foundCodes?.length ?? 0}/${Object.keys(PDF_PRICE_BY_CODE).length}`);

  if (missing?.length) {
    console.log(`  Mağazada bulunamayan kodlar: ${missing.join(', ')}`);
  }

  if (!changed) {
    console.log('  Tüm eşleşen ürünler zaten güncel.');
    return { updated: 0, missing };
  }

  await writeTenantStore(dataDir, tenantId, next);
  for (const row of applied) {
    console.log(
      `  ✓ ${row.code} (id ${row.id}) partner=${row.partner} kupon=${row.coupon} kasa=${row.kasa} perakende=${row.perakende}`,
    );
  }
  console.log(`  Güncellenen: ${applied.length}`);
  return { updated: applied.length, missing };
}

async function main() {
  const dataDir = process.argv[2] || join(process.cwd(), 'data');
  console.log(`==> PDF fiyat güncelleme (Ekim 2026): ${dataDir}`);

  const summary = { updated: 0, missing: [] };
  const mainResult = await migrateTenant(dataDir, 'main');
  summary.updated += mainResult.updated;
  summary.missing = mainResult.missing ?? [];

  const tenantsDir = join(dataDir, 'tenants');
  try {
    const entries = await readdir(tenantsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const r = await migrateTenant(dataDir, entry.name);
        summary.updated += r.updated;
      }
    }
  } catch {
    /* no tenants */
  }

  console.log(`\n==> Toplam güncellenen ürün: ${summary.updated}`);
  if (summary.missing.length) {
    console.log(`==> UYARI: ${summary.missing.length} kod mağazada yok (katalogda olmayabilir).`);
  }
  console.log('==> Bitti');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
