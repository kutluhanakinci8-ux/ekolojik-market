import type { Sale } from '../types/product';

export interface CompletedSalePatch {
  paymentMethod?: Exclude<Sale['paymentMethod'], 'split'>;
  total?: number;
  customerName?: string;
  greenleafNumber?: string;
  businessDate?: string;
  note?: string;
}

export function applyCompletedSalePatch(sale: Sale, patch: CompletedSalePatch): Sale {
  const total = patch.total != null ? roundMoney(patch.total) : sale.total;
  const paymentMethod = patch.paymentMethod ?? (sale.paymentMethod === 'split' ? 'cash' : sale.paymentMethod);

  return {
    ...sale,
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

function roundMoney(n: number): number {
  return Math.round(Number(n) * 100) / 100;
}
