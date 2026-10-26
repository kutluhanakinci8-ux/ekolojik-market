import type { CartItem, Sale } from '../types/product';
import { validatePaymentSplits } from '../utils/posCheckout';

export interface CompletedSalePatch {
  paymentMethod?: Sale['paymentMethod'];
  paymentSplits?: Sale['paymentSplits'];
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
  const method = patch.paymentMethod ?? sale.paymentMethod;
  const lineTotal = sumSaleLineTotal(items);
  const total = patch.total != null ? roundMoney(patch.total) : lineTotal;
  if (method === 'gift') {
    if (lineTotal <= 0 || Number.isNaN(lineTotal)) {
      return 'Hediye için ürün satırları ve birim fiyatları gerekli';
    }
  } else if (total <= 0 || Number.isNaN(total)) {
    return 'Geçerli tutar girin';
  }

  if (method === 'split') {
    const splits = patch.paymentSplits ?? sale.paymentSplits;
    if (!splits?.length) {
      return 'Bölünmüş ödeme için nakit ve kart tutarlarını girin';
    }
    const splitErr = validatePaymentSplits(total, splits);
    if (splitErr) return splitErr;
  }

  return null;
}

export function applyCompletedSalePatch(sale: Sale, patch: CompletedSalePatch): Sale {
  const items = patch.items ? normalizeCartItems(patch.items) : sale.items;
  const derivedTotal = sumSaleLineTotal(items);
  const paymentMethod = patch.paymentMethod ?? sale.paymentMethod;
  const total = paymentMethod === 'gift'
    ? 0
    : (patch.total != null ? roundMoney(patch.total) : derivedTotal);
  const giftRetailTotal = paymentMethod === 'gift' ? derivedTotal : undefined;

  let paymentSplits: Sale['paymentSplits'];
  if (paymentMethod === 'split') {
    paymentSplits = patch.paymentSplits ?? sale.paymentSplits;
  } else {
    paymentSplits = undefined;
  }

  const cashFromSplit = paymentSplits?.find((s) => s.method === 'cash')?.amount;
  const cashTendered = paymentMethod === 'cash'
    ? total
    : paymentMethod === 'split' && cashFromSplit != null
      ? cashFromSplit
      : undefined;
  const changeGiven = paymentMethod === 'cash'
    ? 0
    : paymentMethod === 'split'
      ? 0
      : undefined;

  return {
    ...sale,
    items,
    total,
    paymentMethod,
    paymentSplits,
    cashTendered,
    changeGiven,
    customerName: patch.customerName !== undefined
      ? (patch.customerName.trim() || undefined)
      : sale.customerName,
    greenleafNumber: patch.greenleafNumber !== undefined
      ? (patch.greenleafNumber.trim() || undefined)
      : sale.greenleafNumber,
    businessDate: patch.businessDate?.trim() || sale.businessDate,
    paymentCorrectedAt: new Date().toISOString(),
    paymentCorrectionNote: patch.note?.trim() || sale.paymentCorrectionNote || 'Muhasebe satış düzenleme',
    giftRetailTotal,
  };
}

export function formatSalePaymentLabel(sale: Sale): string {
  if (sale.paymentMethod === 'split' && sale.paymentSplits?.length) {
    const parts = sale.paymentSplits.map((s) => {
      const label = s.method === 'cash' ? 'Nakit' : s.method === 'card' ? 'Kart' : 'Havale';
      return `${label} ${s.amount.toFixed(2)}`;
    });
    return parts.join(' + ');
  }
  const map: Record<Sale['paymentMethod'], string> = {
    cash: 'Nakit',
    card: 'Kart',
    transfer: 'Havale',
    credit: 'Veresiye',
    split: 'Bölünmüş',
    gift: 'Hediye',
  };
  return map[sale.paymentMethod];
}
