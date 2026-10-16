import type { Product } from '../types/product';
import { irsaliyeEanForCode } from '../data/irsaliyeLuy2026000000002';
import { DEFAULT_VAT_RATE } from './vatAnalytics';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Perakende liste fiyatına %20 KDV ekler (kasa / fiş — KDV dahil). */
export function applyRetailVat(netPrice: number, vatRate = DEFAULT_VAT_RATE): number {
  if (netPrice <= 0) return 0;
  return round2(netPrice * (1 + vatRate / 100));
}

/**
 * Perakende kasa birim fiyatı.
 * Greenleaf: fullSalePrice = net liste, ourPriceWithVat = KDV dahil tahsilat.
 * Lima / brüt ayrı kayıtlı değilse (iki alan yakınsa): KDV hariç liste (fullSalePrice).
 */
export function resolveRetailSaleUnitPrice(
  product: Pick<Product, 'fullSalePrice' | 'ourPriceWithVat'>,
  vatRate = DEFAULT_VAT_RATE,
): number {
  const net = product.fullSalePrice;
  const storedGross = product.ourPriceWithVat;
  if (net <= 0) return Math.max(0, storedGross);

  const expectedGross = applyRetailVat(net, vatRate);
  const grossLooksStored = storedGross >= net * 1.15;
  if (grossLooksStored) {
    return storedGross >= expectedGross * 0.98 ? storedGross : expectedGross;
  }
  return net;
}

export interface PriceCatalogEntry {
  code: string;
  name: string;
  pv: number;
  purchasePrice: number;
  partnerPrice: number;
  couponPrice: number;
  retailPrice: number;
}

export interface ProductPricingInput {
  purchasePrice?: number;
  partnerPrice?: number;
  couponPrice?: number;
  fullSalePrice?: number;
}

/** Stok ekranı / giriş — alış, partner, perakende; KDV alanları otomatik */
type ProductPricingOverlay = Pick<
  Product,
  | 'purchasePrice'
  | 'partnerPrice'
  | 'couponPrice'
  | 'fullSalePrice'
  | 'ourPriceWithVat'
  | 'partnerPriceWithVat'
  | 'ourPercent'
  | 'pv'
  | 'wholesalePrices'
>;

/** Greenleaf seed birleştirme — diskteki fiyatlar katalog satırını ezer */
export function overlayStoredProductPricing<T extends ProductPricingOverlay>(
  catalog: T,
  stored?: Product | null,
): T {
  if (!stored) return catalog;
  return {
    ...catalog,
    purchasePrice: stored.purchasePrice,
    partnerPrice: stored.partnerPrice,
    couponPrice: stored.couponPrice,
    fullSalePrice: stored.fullSalePrice,
    ourPriceWithVat: stored.ourPriceWithVat,
    partnerPriceWithVat: stored.partnerPriceWithVat,
    ourPercent: stored.ourPercent,
    pv: stored.pv,
    wholesalePrices: stored.wholesalePrices ?? catalog.wholesalePrices,
  };
}

export function mergeProductPricing(
  product: Product,
  input: ProductPricingInput,
  retailNetEqualsSale: boolean,
): Product {
  const purchasePrice = round2(Math.max(0, input.purchasePrice ?? product.purchasePrice));
  const partnerPrice = round2(Math.max(0, input.partnerPrice ?? product.partnerPrice));
  const couponPrice = round2(Math.max(0, input.couponPrice ?? product.couponPrice ?? partnerPrice));
  const fullSalePrice = round2(Math.max(0, input.fullSalePrice ?? product.fullSalePrice));
  const ourPriceWithVat = retailNetEqualsSale ? fullSalePrice : applyRetailVat(fullSalePrice);
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
  };
}

export function computeDerivedPrices(partnerPrice: number, retailPrice: number) {
  const ourPercent = Math.max(100, Math.round((retailPrice / partnerPrice - 1) * 100));
  return {
    fullSalePrice: retailPrice,
    ourPercent,
    ourPriceWithVat: Math.round(retailPrice * 1.2 * 100) / 100,
    partnerPriceWithVat: Math.round(partnerPrice * 1.2 * 100) / 100,
  };
}

export function applyCatalogPricing<T extends Omit<Product, 'stock'>>(product: T, entry: PriceCatalogEntry): T {
  const derived = computeDerivedPrices(entry.partnerPrice, entry.retailPrice);
  return {
    ...product,
    productCode: entry.code,
    barcode: irsaliyeEanForCode(entry.code) ?? entry.code,
    pv: entry.pv,
    purchasePrice: entry.purchasePrice,
    partnerPrice: entry.partnerPrice,
    couponPrice: entry.couponPrice,
    ...derived,
  };
}

export function derivePurchasePrice(partnerPrice: number): number {
  return Math.round(partnerPrice * 0.82 * 100) / 100;
}

/** İrsaliye / tedarik birim alış fiyatından partner (%82) ve perakende (2× partner) türetir */
export function entryFromPurchasePrice(
  code: string,
  name: string,
  pv: number,
  purchasePrice: number,
): PriceCatalogEntry {
  const purchase = Math.round(purchasePrice * 100) / 100;
  const partnerPrice = Math.round((purchase / 0.82) * 100) / 100;
  const retailPrice = Math.round(partnerPrice * 2 * 100) / 100;
  return {
    code,
    name,
    pv,
    purchasePrice: purchase,
    partnerPrice,
    couponPrice: partnerPrice,
    retailPrice,
  };
}
