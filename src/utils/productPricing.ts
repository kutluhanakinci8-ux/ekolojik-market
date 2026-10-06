import type { Product } from '../types/product';

export interface PriceCatalogEntry {
  code: string;
  name: string;
  pv: number;
  purchasePrice: number;
  partnerPrice: number;
  couponPrice: number;
  retailPrice: number;
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
    barcode: entry.code,
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
