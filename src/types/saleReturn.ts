import type { CartItem, PriceType, SaleStatus } from './product';

export type { SaleStatus };

export interface SaleReturnLine {
  lineKey: string;
  productId?: number;
  setId?: string;
  priceType: PriceType;
  quantity: number;
  unitPrice: number;
}

export interface SaleReturn {
  id: string;
  originalSaleId: string;
  items: SaleReturnLine[];
  refundTotal: number;
  refundMethod: 'cash' | 'card' | 'transfer' | 'credit';
  reason?: string;
  note?: string;
  cashierId?: string;
  cashierName?: string;
  /** YYYY-MM-DD — operasyonel iş günü (yoksa createdAt kullanılır) */
  businessDate?: string;
  /** Banka müşteri iadesi fişi ile bağlantı */
  journalVoucherId?: string;
  bankAccountId?: string;
  createdAt: string;
}

export function getCartLineKey(item: Pick<CartItem, 'productId' | 'setId' | 'priceType'>): string {
  if (item.setId) return `set:${item.setId}:${item.priceType}`;
  return `product:${item.productId}:${item.priceType}`;
}

export function parseCartLineKey(lineKey: string): {
  productId?: number;
  setId?: string;
  priceType: PriceType;
} | null {
  const setMatch = lineKey.match(/^set:(.+):(\w+)$/);
  if (setMatch) {
    return { setId: setMatch[1], priceType: setMatch[2] as PriceType };
  }
  const productMatch = lineKey.match(/^product:(\d+):(\w+)$/);
  if (productMatch) {
    return { productId: Number.parseInt(productMatch[1], 10), priceType: productMatch[2] as PriceType };
  }
  return null;
}
