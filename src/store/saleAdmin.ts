import type { CartItem, Sale } from '../types/product';

export interface CompletedSalePatch {
  paymentMethod?: Exclude<Sale['paymentMethod'], 'split'>;
  total?: number;
  customerName?: string;
  greenleafNumber?: string;
  businessDate?: string;
  note?: string;
  items?: CartItem[];
}

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}

export function sumSaleLineTotal(items: CartItem[]): number {
  return roundMoney(
    items.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
  );
}

function normalizeCartItems(items: CartItem[]): CartItem[] {
  return items
    .map((line) => ({
      ...line,
      quantity: line.quantity,
      unitPrice: roundMoney(line.unitPrice),
    }))
    .filter((line) => {
      if (line.setId && !line.productId) return line.quantity > 0;
      return Boolean(line.productId) && line.quantity > 0 && line.unitPrice > 0;
    });
}

export function validateCompletedSalePatch(
  sale: Sale,
  patch: CompletedSalePatch,
): string | null {
  if (sale.paymentMethod === 'split' && !patch.paymentMethod) {
    return 'Bölünmüş ödeme satışı buradan düzenlenemez';
  }
  const items = patch.items ? normalizeCartItems(patch.items) : sale.items;
  const productLines = items.filter((line) => line.productId);
  if (patch.items && productLines.length === 0) {
    return 'En az bir ürün satırı gerekli';
  }
  for (const line of productLines) {
    if (line.quantity <= 0 || Number.isNaN(line.quantity)) {
      return 'Adet 0’dan büyük olmalı';
    }
    if (line.unitPrice <= 0 || Number.isNaN(line.unitPrice)) {
      return 'Birim fiyat geçerli olmalı';
    }
  }
  const total = patch.total != null ? roundMoney(patch.total) : sumSaleLineTotal(items);
  if (total <= 0 || Number.isNaN(total)) {
    return 'Geçerli tutar girin';
  }
  return null;
}

export function applyCompletedSalePatch(sale: Sale, patch: CompletedSalePatch): Sale {
  const paymentMethod = patch.paymentMethod ?? (sale.paymentMethod === 'split' ? 'cash' : sale.paymentMethod);
  const items = patch.items ? normalizeCartItems(patch.items) : sale.items;
  const derivedTotal = sumSaleLineTotal(items);
  const total = patch.total != null ? roundMoney(patch.total) : derivedTotal;

  return {
    ...sale,
    items,
    total,
    paymentMethod,
    paymentSplits: undefined,
    cashTendered: paymentMethod === 'cash' ? total : undefined,
    changeGiven: paymentMethod === 'cash' ? 0 : undefined,
    customerName: patch.customerName !== undefined
      ? (patch.customerName.trim() || undefined)
      : sale.customerName,
    greenleafNumber: patch.greenleafNumber !== undefined
      ? (patch.greenleafNumber.trim() || undefined)
      : sale.greenleafNumber,
    businessDate: patch.businessDate?.trim() || sale.businessDate,
    paymentCorrectedAt: new Date().toISOString(),
    paymentCorrectionNote: patch.note?.trim() || sale.paymentCorrectionNote || 'Muhasebe satış düzenleme',
  };
}
