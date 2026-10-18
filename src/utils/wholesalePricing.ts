import type { Product, WholesalePrices } from '../types/product';

export const WHOLESALE_QUANTITIES = [10, 20, 50, 100] as const;

const VAT_MULTIPLIER = 1.2;

export function applyWholesaleVat(netPrice: number): number {
  return Math.round(netPrice * VAT_MULTIPLIER * 100) / 100;
}

export function generateDefaultWholesalePrices(catalogRetailPrice: number): WholesalePrices {
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    qty10: round(catalogRetailPrice * 0.92),
    qty20: round(catalogRetailPrice * 0.87),
    qty50: round(catalogRetailPrice * 0.82),
    qty100: round(catalogRetailPrice * 0.76),
  };
}

export function getWholesaleTierKey(quantity: number): keyof WholesalePrices | null {
  if (quantity >= 100) return 'qty100';
  if (quantity >= 50) return 'qty50';
  if (quantity >= 20) return 'qty20';
  if (quantity >= 10) return 'qty10';
  return null;
}

export function getWholesaleTierLabel(quantity: number): string | null {
  const tier = getWholesaleTierKey(quantity);
  if (!tier) return null;
  const labels: Record<keyof WholesalePrices, string> = {
    qty10: '10+ adet',
    qty20: '20+ adet',
    qty50: '50+ adet',
    qty100: '100+ adet',
  };
  return labels[tier];
}

export function getWholesaleUnitPrice(product: Product, quantity: number): number | null {
  const tiers = product.wholesalePrices;
  if (!tiers) return null;
  const tier = getWholesaleTierKey(quantity);
  if (!tier) return null;
  return tiers[tier];
}

/** Toptan fiyatlar KDV hariç saklanır; eski kayıtlar KDV dahil tabanlı olabilir. */
export function resolveWholesalePrices(fullSalePrice: number, saved?: WholesalePrices): WholesalePrices {
  if (!saved) {
    return generateDefaultWholesalePrices(fullSalePrice);
  }
  if (saved.qty10 > fullSalePrice * 1.05) {
    const toNet = (value: number) => Math.round(value / VAT_MULTIPLIER * 100) / 100;
    return {
      qty10: toNet(saved.qty10),
      qty20: toNet(saved.qty20),
      qty50: toNet(saved.qty50),
      qty100: toNet(saved.qty100),
    };
  }
  return saved;
}

export function parseWholesalePrices(input: {
  qty10: string;
  qty20: string;
  qty50: string;
  qty100: string;
}): WholesalePrices | null {
  const qty10 = Number.parseFloat(input.qty10);
  const qty20 = Number.parseFloat(input.qty20);
  const qty50 = Number.parseFloat(input.qty50);
  const qty100 = Number.parseFloat(input.qty100);
  if ([qty10, qty20, qty50, qty100].some((value) => Number.isNaN(value) || value < 0)) {
    return null;
  }
  return { qty10, qty20, qty50, qty100 };
}

export type WholesalePriceBase = 'purchase' | 'partner' | 'coupon' | 'retail';

export const WHOLESALE_BASE_LABELS: Record<WholesalePriceBase, string> = {
  purchase: 'Alış',
  partner: 'Partner',
  coupon: 'Kupon',
  retail: 'Perakende',
};

export interface WholesaleTierDiscounts {
  qty10: number;
  qty20: number;
  qty50: number;
  qty100: number;
}

export function getProductWholesaleBasePrice(product: Product, base: WholesalePriceBase): number {
  switch (base) {
    case 'purchase':
      return product.purchasePrice;
    case 'partner':
      return product.partnerPrice;
    case 'coupon':
      return product.couponPrice ?? product.partnerPrice;
    case 'retail':
      return product.fullSalePrice;
    default:
      return product.fullSalePrice;
  }
}

export function buildWholesalePricesFromBase(
  basePrice: number,
  discounts: WholesaleTierDiscounts,
): WholesalePrices {
  const round = (value: number) => Math.round(value * 100) / 100;
  const price = (discountPercent: number) => round(basePrice * (1 - discountPercent / 100));
  return {
    qty10: price(discounts.qty10),
    qty20: price(discounts.qty20),
    qty50: price(discounts.qty50),
    qty100: price(discounts.qty100),
  };
}
