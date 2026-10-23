import type { Product } from '../types/product';
import { irsaliyeEanForCode } from '../data/irsaliyeLuy2026000000002';
import { DEFAULT_VAT_RATE } from './vatAnalytics';

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Perakende liste fiyatına %20 KDV ekler (kasa / fiş — KDV dahil). */
export function applyRetailVat(netPrice: number, vatRate = DEFAULT_VAT_RATE): number {
  if (netPrice <= 0) return 0;
  return round2(netPrice * (1 + vatRate / 100));
}

/** Stok girişi: kasa (KDV dahil) yazıldığında perakende net = brütün %20'si düşülür. */
export const RETAIL_NET_FROM_KASA_FACTOR = 0.8;

export function retailNetFromKasaGross(kasaGross: number): number {
  return round2(Math.max(0, kasaGross) * RETAIL_NET_FROM_KASA_FACTOR);
}

export function kasaGrossFromRetailNet(retailNet: number): number {
  if (retailNet <= 0) return 0;
  return round2(retailNet / RETAIL_NET_FROM_KASA_FACTOR);
}

/** Stok girişi kasa alanı — kayıtlı brüt veya perakende netten türetilmiş brüt */
export function resolveStockEntryKasaGross(
  product: Pick<Product, 'fullSalePrice' | 'ourPriceWithVat'>,
): number {
  const storedKasa = product.ourPriceWithVat;
  const kasaFromNet = kasaGrossFromRetailNet(product.fullSalePrice);
  return storedKasa > product.fullSalePrice * 1.05 ? storedKasa : kasaFromNet;
}

/** @deprecated Stok girişi: partner/kupon perakende netin %50'si — `partnerPriceFromRetail` kullanın. */
export function partnerPriceFromKasaGross(kasaGross: number): number {
  return partnerPriceFromRetail(retailNetFromKasaGross(kasaGross));
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
  /** Kasa / fiş — KDV dahil tahsilat (stok girişi kasa alanından) */
  ourPriceWithVat?: number;
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
  let ourPriceWithVat: number;
  if (input.ourPriceWithVat != null) {
    ourPriceWithVat = round2(Math.max(0, input.ourPriceWithVat));
  } else if (input.fullSalePrice != null) {
    ourPriceWithVat = retailNetEqualsSale
      ? kasaGrossFromRetailNet(fullSalePrice)
      : applyRetailVat(fullSalePrice);
  } else {
    ourPriceWithVat = round2(Math.max(0, product.ourPriceWithVat));
  }
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

export function computeDerivedPrices(partnerPrice: number, retailPrice: number) {
  const ourPercent = Math.max(100, Math.round((retailPrice / partnerPrice - 1) * 100));
  return {
    fullSalePrice: retailPrice,
    ourPercent,
    ourPriceWithVat: Math.round(retailPrice * 1.2 * 100) / 100,
    partnerPriceWithVat: Math.round(partnerPrice * 1.2 * 100) / 100,
  };
}

export function partnerPriceFromRetail(retailPrice: number): number {
  return round2(Math.max(0, retailPrice) / 2);
}

export function applyCatalogPricing<T extends Omit<Product, 'stock'>>(product: T, entry: PriceCatalogEntry): T {
  const retailPrice = round2(entry.retailPrice);
  const partnerPrice = partnerPriceFromRetail(retailPrice);
  const couponPrice = round2(entry.couponPrice ?? partnerPrice);
  const derived = computeDerivedPrices(partnerPrice, retailPrice);
  return {
    ...product,
    productCode: entry.code,
    barcode: irsaliyeEanForCode(entry.code) ?? entry.code,
    pv: entry.pv,
    purchasePrice: entry.purchasePrice,
    partnerPrice,
    couponPrice,
    ...derived,
  };
}

export function derivePurchasePrice(partnerPrice: number): number {
  return Math.round(partnerPrice * 0.82 * 100) / 100;
}

/** İrsaliye alış → perakende (2× eski partner kuralı); partner = perakendenin yarısı */
export function entryFromPurchasePrice(
  code: string,
  name: string,
  pv: number,
  purchasePrice: number,
): PriceCatalogEntry {
  const purchase = round2(purchasePrice);
  const partnerFromPurchase = round2(purchase / 0.82);
  const retailPrice = round2(partnerFromPurchase * 2);
  const partnerPrice = partnerPriceFromRetail(retailPrice);
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
