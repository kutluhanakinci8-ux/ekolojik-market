/** Tek ürün fiyat güncelleme — tam store PUT birleştirmesinden bağımsız */

import { readTenantStore, writeTenantStore } from './tenantAuth.mjs';

const DEFAULT_VAT = 20;

function round2(value) {
  return Math.round(Number(value) * 100) / 100;
}

function applyRetailVat(netPrice, vatRate = DEFAULT_VAT) {
  if (netPrice <= 0) return 0;
  return round2(netPrice * (1 + vatRate / 100));
}

function usesNetRetailWithVatBreakdown(settings) {
  const profile = settings?.productProfile;
  const name = String(settings?.businessName ?? '').toLowerCase();
  return profile === 'pos-lite' || name.includes('lima');
}

/** Perakende sabit; partner ve kupon = perakendenin tam yarısı */
export function applyPartnerHalfRetailPricing(product, settings) {
  const fullSalePrice = round2(Math.max(0, product.fullSalePrice ?? 0));
  if (fullSalePrice <= 0) {
    return applyProductPricingPatch(
      product,
      { partnerPrice: 0, couponPrice: 0 },
      settings,
    );
  }
  const partnerPrice = round2(fullSalePrice / 2);
  return applyProductPricingPatch(
    product,
    { partnerPrice, couponPrice: partnerPrice },
    settings,
  );
}

export function applyProductPricingPatch(product, patch, settings) {
  const retailNet = usesNetRetailWithVatBreakdown(settings);
  const purchasePrice = round2(Math.max(0, patch.purchasePrice ?? product.purchasePrice ?? 0));
  const partnerPrice = round2(Math.max(0, patch.partnerPrice ?? product.partnerPrice ?? 0));
  const couponPrice = round2(Math.max(0, patch.couponPrice ?? product.couponPrice ?? partnerPrice));
  const fullSalePrice = round2(Math.max(0, patch.fullSalePrice ?? product.fullSalePrice ?? 0));
  const ourPriceWithVat = retailNet ? fullSalePrice : applyRetailVat(fullSalePrice);
  const partnerPriceWithVat = applyRetailVat(partnerPrice);
  const ourPercent = purchasePrice > 0
    ? round2(((fullSalePrice - purchasePrice) / purchasePrice) * 100)
    : product.ourPercent;

  return {
    ...product,
    purchasePrice,
    partnerPrice,
    couponPrice,
    fullSalePrice,
    ourPriceWithVat,
    partnerPriceWithVat,
    ourPercent,
    pricingUpdatedAt: new Date().toISOString(),
  };
}

export async function patchTenantProductPricing(dataDir, tenantId, productId, patch, settings) {
  const id = Number(productId);
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, status: 400, error: 'Geçersiz ürün id' };
  }
  const store = await readTenantStore(dataDir, tenantId);
  if (!store?.products?.length) {
    return { ok: false, status: 404, error: 'Mağaza bulunamadı' };
  }
  const index = store.products.findIndex((p) => Number(p.id) === id);
  if (index < 0) {
    return { ok: false, status: 404, error: 'Ürün bulunamadı' };
  }
  const updated = applyProductPricingPatch(store.products[index], patch ?? {}, settings ?? store.settings);
  const products = [...store.products];
  products[index] = updated;
  const nextStore = {
    ...store,
    products,
    updatedAt: new Date().toISOString(),
  };
  await writeTenantStore(dataDir, tenantId, nextStore);
  return { ok: true, product: updated, updatedAt: nextStore.updatedAt };
}
