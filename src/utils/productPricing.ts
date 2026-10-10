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
