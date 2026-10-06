import type { CartItem, Sale } from '../types/product';
import type { SaleReturn, SaleReturnLine, SaleStatus } from '../types/saleReturn';
import { getCartLineKey } from '../types/saleReturn';
import { isSaleReturnableByCashier } from './cashierPrivacy';

export interface ReturnableLine {
  lineKey: string;
  productId?: number;
  setId?: string;
  priceType: CartItem['priceType'];
  soldQuantity: number;
  returnedQuantity: number;
  returnableQuantity: number;
  unitPrice: number;
  lineTotal: number;
}

export function getReturnsForSale(saleId: string, saleReturns: SaleReturn[]): SaleReturn[] {
  return saleReturns.filter((entry) => entry.originalSaleId === saleId);
}

export function getReturnedQuantityByLine(saleId: string, lineKey: string, saleReturns: SaleReturn[]): number {
  return getReturnsForSale(saleId, saleReturns).reduce((sum, entry) => {
    const line = entry.items.find((item) => item.lineKey === lineKey);
    return sum + (line?.quantity ?? 0);
  }, 0);
}

export function getReturnableLines(sale: Sale, saleReturns: SaleReturn[]): ReturnableLine[] {
  return sale.items.map((item) => {
    const lineKey = getCartLineKey(item);
    const returnedQuantity = getReturnedQuantityByLine(sale.id, lineKey, saleReturns);
    const returnableQuantity = Math.max(0, item.quantity - returnedQuantity);
    return {
      lineKey,
      productId: item.productId,
      setId: item.setId,
      priceType: item.priceType,
      soldQuantity: item.quantity,
      returnedQuantity,
      returnableQuantity,
      unitPrice: item.unitPrice,
      lineTotal: item.unitPrice * item.quantity,
    };
  });
}

export function getSaleRefundedTotal(saleId: string, saleReturns: SaleReturn[]): number {
  return getReturnsForSale(saleId, saleReturns).reduce((sum, entry) => sum + entry.refundTotal, 0);
}

export function getSaleNetTotal(sale: Sale, saleReturns: SaleReturn[]): number {
  return Math.max(0, sale.total - getSaleRefundedTotal(sale.id, saleReturns));
}

export function getSaleStatus(sale: Sale, saleReturns: SaleReturn[]): SaleStatus {
  const explicit = sale.status;
  if (explicit === 'fully_returned' || explicit === 'partially_returned') return explicit;

  const returnable = getReturnableLines(sale, saleReturns);
  const totalSold = returnable.reduce((sum, line) => sum + line.soldQuantity, 0);
  const totalReturned = returnable.reduce((sum, line) => sum + line.returnedQuantity, 0);

  if (totalReturned <= 0) return 'completed';
  if (totalReturned >= totalSold) return 'fully_returned';
  return 'partially_returned';
}

/** Bankadan müşteri iadesi fişi için: müşteriye bağlı, iade edilebilir satışlar ve tam iade tutarı */
export function listCustomerSalesForBankRefund(
  customerId: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
): Array<{ sale: Sale; refundTotal: number }> {
  return sales
    .filter((sale) => sale.customerId === customerId && canReturnSale(sale, saleReturns))
    .map((sale) => {
      const lines = getReturnableLines(sale, saleReturns);
      const refundTotal = lines.reduce(
        (sum, line) => (
          line.returnableQuantity > 0 && line.priceType !== 'sample'
            ? sum + line.unitPrice * line.returnableQuantity
            : sum
        ),
        0,
      );
      return { sale, refundTotal: Math.round(refundTotal * 100) / 100 };
    })
    .filter((entry) => entry.refundTotal > 0);
}

export function buildFullSaleReturnRequest(
  sale: Sale,
  saleReturns: SaleReturn[],
): Array<{ lineKey: string; quantity: number }> {
  return getReturnableLines(sale, saleReturns)
    .filter((line) => line.returnableQuantity > 0)
    .map((line) => ({ lineKey: line.lineKey, quantity: line.returnableQuantity }));
}

export function canReturnSale(
  sale: Sale,
  saleReturns: SaleReturn[],
  options?: { cashierMode?: boolean },
): boolean {
  if (options?.cashierMode && !isSaleReturnableByCashier(sale.createdAt)) {
    return false;
  }
  return getReturnableLines(sale, saleReturns).some((line) => line.returnableQuantity > 0);
}

export function buildReturnLines(
  sale: Sale,
  saleReturns: SaleReturn[],
  requested: Array<{ lineKey: string; quantity: number }>,
): { ok: true; lines: SaleReturnLine[]; refundTotal: number } | { ok: false; message: string } {
  const returnable = getReturnableLines(sale, saleReturns);
  const lines: SaleReturnLine[] = [];
  let refundTotal = 0;

  for (const request of requested) {
    if (request.quantity <= 0) continue;
    const line = returnable.find((entry) => entry.lineKey === request.lineKey);
    if (!line) return { ok: false, message: 'Geçersiz iade satırı' };
    if (request.quantity > line.returnableQuantity) {
      return { ok: false, message: `İade miktarı satılan adedi aşamaz (${line.returnableQuantity} adet)` };
    }
    lines.push({
      lineKey: line.lineKey,
      productId: line.productId,
      setId: line.setId,
      priceType: line.priceType,
      quantity: request.quantity,
      unitPrice: line.unitPrice,
    });
    if (line.priceType !== 'sample') {
      refundTotal += line.unitPrice * request.quantity;
    }
  }

  if (lines.length === 0) {
    return { ok: false, message: 'İade için ürün seçin' };
  }

  return { ok: true, lines, refundTotal };
}

export function filterReturnsByPeriod(saleReturns: SaleReturn[], period: 'today' | 'week' | 'month' | 'all'): SaleReturn[] {
  if (period === 'all') return saleReturns;
  const now = new Date();
  const start = new Date(now);
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 7);
  } else {
    start.setMonth(now.getMonth() - 1);
  }
  return saleReturns.filter((entry) => new Date(entry.createdAt) >= start);
}

export function filterReturnsByDateRange(saleReturns: SaleReturn[], from: string, to: string): SaleReturn[] {
  if (!from && !to) return saleReturns;
  const start = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();
  if (start.getTime() > end.getTime()) return [];
  return saleReturns.filter((entry) => {
    const createdAt = new Date(entry.createdAt);
    return createdAt >= start && createdAt <= end;
  });
}
