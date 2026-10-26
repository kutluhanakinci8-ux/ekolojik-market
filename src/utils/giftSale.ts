import type { Sale } from '../types/product';
import { sumSaleLineTotal } from '../store/saleAdmin';

export function isGiftSale(sale: Sale): boolean {
  return sale.paymentMethod === 'gift';
}

/** Hediye satışında müşteriye yansıyan perakende tutar (KDV dahil, satır toplamı). */
export function resolveGiftRetailGross(sale: Sale): number {
  if (sale.giftRetailTotal != null && sale.giftRetailTotal > 0) {
    return sale.giftRetailTotal;
  }
  return sumSaleLineTotal(sale.items ?? []);
}

export function sumGiftRetailGross(sales: Sale[]): number {
  return Math.round(
    sales
      .filter(isGiftSale)
      .reduce((sum, sale) => sum + resolveGiftRetailGross(sale), 0) * 100,
  ) / 100;
}
