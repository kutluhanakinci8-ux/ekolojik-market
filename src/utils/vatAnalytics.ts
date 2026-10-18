import type { PurchaseInvoice } from '../types/business';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { ReportPeriod } from './analytics';
import { filterSalesByDateRange, filterSalesByPeriod } from './analytics';

export const DEFAULT_VAT_RATE = 20;

export interface VatSummary {
  salesGross: number;
  salesNet: number;
  salesVat: number;
  purchaseGross: number;
  purchaseNet: number;
  purchaseVat: number;
  payableVat: number;
  /** İndirilecek KDV, hesaplanandan fazlaysa devreden tutar */
  carryForwardVat: number;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function splitGrossAmount(grossAmount: number, vatRate: number) {
  const rate = vatRate / 100;
  const netAmount = roundMoney(grossAmount / (1 + rate));
  const vatAmount = roundMoney(grossAmount - netAmount);
  return { netAmount, vatAmount, grossAmount: roundMoney(grossAmount) };
}

export function filterInvoicesByPeriod(invoices: PurchaseInvoice[], period: ReportPeriod): PurchaseInvoice[] {
  if (period === 'all') return invoices;

  const now = new Date();
  const start = new Date(now);
  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else if (period === 'week') {
    start.setDate(now.getDate() - 7);
  } else {
    start.setMonth(now.getMonth() - 1);
  }

  return invoices.filter((invoice) => new Date(`${invoice.invoiceDate}T12:00:00`) >= start);
}

export function filterInvoicesByDateRange(
  invoices: PurchaseInvoice[],
  from: string,
  to: string,
): PurchaseInvoice[] {
  if (!from && !to) return invoices;

  const start = from ? new Date(`${from}T00:00:00`) : new Date(0);
  const end = to ? new Date(`${to}T23:59:59.999`) : new Date();

  if (start.getTime() > end.getTime()) return [];

  return invoices.filter((invoice) => {
    const createdAt = new Date(`${invoice.invoiceDate}T12:00:00`);
    return createdAt >= start && createdAt <= end;
  });
}

export function calculateSalesVat(sales: Sale[], vatRate = DEFAULT_VAT_RATE): Pick<VatSummary, 'salesGross' | 'salesNet' | 'salesVat'> {
  const salesGross = roundMoney(sales.reduce((sum, sale) => sum + sale.total, 0));
  const salesNet = sumSalesNetFromGrossTotals(sales, vatRate);
  const salesVat = roundMoney(salesGross - salesNet);
  return { salesGross, salesNet, salesVat };
}

/** Kasa fiş tutarı KDV dahil — mizan 600 ile uyumlu net satış */
export function sumSalesNetFromGrossTotals(sales: Sale[], vatRate = DEFAULT_VAT_RATE): number {
  return roundMoney(sales.reduce((sum, sale) => {
    if (sale.total <= 0) return sum;
    return sum + splitGrossAmount(sale.total, vatRate).netAmount;
  }, 0));
}

export function sumReturnsNetFromGrossTotals(
  saleReturns: SaleReturn[],
  vatRate = DEFAULT_VAT_RATE,
): number {
  return roundMoney(saleReturns.reduce((sum, entry) => {
    if (entry.refundTotal <= 0) return sum;
    return sum + splitGrossAmount(entry.refundTotal, vatRate).netAmount;
  }, 0));
}

export type PaymentBreakdown = Record<'cash' | 'card' | 'transfer' | 'credit', number>;

/** Ödeme tipine göre KDV hariç net tahsilat (gelir tablosu net satış ile uyumlu) */
export function getPaymentBreakdownNet(
  sales: Sale[],
  saleReturns: SaleReturn[] = [],
  vatRate = DEFAULT_VAT_RATE,
): PaymentBreakdown {
  const breakdown: PaymentBreakdown = { cash: 0, card: 0, transfer: 0, credit: 0 };
  for (const sale of sales) {
    if (sale.total <= 0) continue;
    const saleNet = splitGrossAmount(sale.total, vatRate).netAmount;
    if (sale.paymentMethod === 'split' && sale.paymentSplits?.length) {
      const grossTotal = sale.total;
      for (const split of sale.paymentSplits) {
        if (split.method in breakdown) {
          const portion = grossTotal > 0 ? split.amount / grossTotal : 0;
          breakdown[split.method] += saleNet * portion;
        }
      }
    } else if (
      sale.paymentMethod === 'cash'
      || sale.paymentMethod === 'card'
      || sale.paymentMethod === 'transfer'
      || sale.paymentMethod === 'credit'
    ) {
      breakdown[sale.paymentMethod] += saleNet;
    }
  }
  for (const entry of saleReturns) {
    if (entry.refundTotal <= 0) continue;
    const retNet = splitGrossAmount(entry.refundTotal, vatRate).netAmount;
    if (entry.refundMethod in breakdown) {
      breakdown[entry.refundMethod] -= retNet;
    }
  }
  return {
    cash: roundMoney(breakdown.cash),
    card: roundMoney(breakdown.card),
    transfer: roundMoney(breakdown.transfer),
    credit: roundMoney(breakdown.credit),
  };
}

export function sumGrossCollections(
  sales: Sale[],
  saleReturns: SaleReturn[] = [],
): number {
  const grossSales = roundMoney(sales.reduce((sum, sale) => sum + sale.total, 0));
  const grossReturns = roundMoney(saleReturns.reduce((sum, row) => sum + row.refundTotal, 0));
  return roundMoney(grossSales - grossReturns);
}

export function calculatePurchaseVat(
  invoices: PurchaseInvoice[],
): Pick<VatSummary, 'purchaseGross' | 'purchaseNet' | 'purchaseVat'> {
  const purchaseGross = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.grossAmount, 0));
  const purchaseNet = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.netAmount, 0));
  const purchaseVat = roundMoney(invoices.reduce((sum, invoice) => sum + invoice.vatAmount, 0));
  return { purchaseGross, purchaseNet, purchaseVat };
}

export function calculateVatSummary(
  sales: Sale[],
  invoices: PurchaseInvoice[],
  vatRate = DEFAULT_VAT_RATE,
): VatSummary {
  const salesPart = calculateSalesVat(sales, vatRate);
  const purchasePart = calculatePurchaseVat(invoices);
  const vatDelta = roundMoney(salesPart.salesVat - purchasePart.purchaseVat);
  const payableVat = roundMoney(Math.max(0, vatDelta));
  const carryForwardVat = roundMoney(Math.max(0, -vatDelta));

  return {
    ...salesPart,
    ...purchasePart,
    payableVat,
    carryForwardVat,
  };
}

export function filterVatData(
  sales: Sale[],
  invoices: PurchaseInvoice[],
  period: ReportPeriod,
  useCustomRange: boolean,
  dateFrom: string,
  dateTo: string,
) {
  const filteredSales = useCustomRange && dateFrom && dateTo
    ? filterSalesByDateRange(sales, dateFrom, dateTo)
    : filterSalesByPeriod(sales, period);

  const filteredInvoices = useCustomRange && dateFrom && dateTo
    ? filterInvoicesByDateRange(invoices, dateFrom, dateTo)
    : filterInvoicesByPeriod(invoices, period);

  return { filteredSales, filteredInvoices };
}
