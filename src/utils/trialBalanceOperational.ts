import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { Product } from '../types/product';
import type { ReportPeriod } from './analytics';
import { DEFAULT_VAT_RATE, splitGrossAmount } from './vatAnalytics';
import { matchesReportPeriod } from './trialBalancePeriod';

interface AccountAgg {
  accountName: string;
  debit: number;
  credit: number;
  glParent?: string;
  closingBalance?: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function saleBusinessDateKey(sale: Sale): string {
  if (sale.businessDate?.trim()) return sale.businessDate.trim();
  return sale.createdAt.slice(0, 10);
}

function returnBusinessDateKey(entry: SaleReturn): string {
  if (entry.businessDate?.trim()) return entry.businessDate.trim();
  return entry.createdAt.slice(0, 10);
}

function paymentAccountForSale(sale: Sale): string {
  if (sale.paymentMethod === 'credit') return '120';
  if (sale.paymentMethod === 'card' || sale.paymentMethod === 'transfer') return '102';
  return '100';
}

function paymentAccountForReturn(entry: SaleReturn): string {
  if (entry.refundMethod === 'credit') return '120';
  if (entry.refundMethod === 'card' || entry.refundMethod === 'transfer') return '102';
  return '100';
}

function computeSaleCogs(sale: Sale, products: Product[]): number {
  let cogs = 0;
  for (const item of sale.items) {
    if (item.priceType === 'sample') continue;
    if (item.productId == null) continue;
    const product = products.find((p) => p.id === item.productId);
    cogs += (product?.purchasePrice ?? 0) * item.quantity;
  }
  return roundMoney(cogs);
}

function computeReturnCogs(entry: SaleReturn, originalSale: Sale | undefined, products: Product[]): number {
  if (!originalSale) return 0;
  let cogs = 0;
  for (const line of entry.items) {
    if (line.priceType === 'sample') continue;
    if (line.productId == null) continue;
    const product = products.find((p) => p.id === line.productId);
    cogs += (product?.purchasePrice ?? 0) * line.quantity;
  }
  return roundMoney(cogs);
}

function bump(
  map: Map<string, AccountAgg>,
  accountCode: string,
  accountName: string,
  debit: number,
  credit: number,
): void {
  if (debit <= 0 && credit <= 0) return;
  const existing = map.get(accountCode) ?? {
    accountName,
    debit: 0,
    credit: 0,
  };
  existing.debit += debit;
  existing.credit += credit;
  if (accountName.trim()) {
    existing.accountName = accountName;
  }
  map.set(accountCode, existing);
}

const ACCOUNT_NAMES: Record<string, string> = {
  '100': 'Kasa',
  '102': 'Bankalar',
  '120': 'Alıcılar (Müşteri Cari)',
  '153': 'Ticari Mallar',
  '391': 'Hesaplanan KDV',
  '600': 'Yurtiçi Satışlar',
  '621': 'Satılan Ticari Mallar Maliyeti',
};

function nameFor(code: string): string {
  return ACCOUNT_NAMES[code] ?? code;
}

function usesSubsidiaryLedgers(flags: {
  includeSubAccounts?: boolean;
  hasCustomerLedger?: boolean;
  hasSupplierLedger?: boolean;
  hasBankTransactions?: boolean;
}): boolean {
  return Boolean(
    flags.includeSubAccounts
    && (flags.hasCustomerLedger || flags.hasSupplierLedger || flags.hasBankTransactions),
  );
}

export interface OperationalTrialBalanceStats {
  salesCount: number;
  returnsCount: number;
}

export function mergeOperationalSalesIntoTrialBalance(
  detailMap: Map<string, AccountAgg>,
  period: ReportPeriod,
  sales: Sale[],
  saleReturns: SaleReturn[],
  products: Product[],
  subsidiaryLedgerFlags: {
    includeSubAccounts?: boolean;
    hasCustomerLedger?: boolean;
    hasSupplierLedger?: boolean;
    hasBankTransactions?: boolean;
  },
  vatRate = DEFAULT_VAT_RATE,
): OperationalTrialBalanceStats {
  const subsidiary = usesSubsidiaryLedgers(subsidiaryLedgerFlags);
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));

  const periodSales = sales.filter((sale) => (
    sale.total > 0
    && matchesReportPeriod(saleBusinessDateKey(sale), sale.createdAt, period)
  ));
  const periodReturns = saleReturns.filter((entry) => (
    entry.refundTotal > 0
    && matchesReportPeriod(returnBusinessDateKey(entry), entry.createdAt, period)
  ));

  for (const sale of periodSales) {
    const gross = roundMoney(sale.total);
    const { netAmount, vatAmount } = splitGrossAmount(gross, vatRate);
    const payAcc = paymentAccountForSale(sale);
    const skipPaymentSide = subsidiary && payAcc === '120';

    if (!skipPaymentSide) {
      bump(detailMap, payAcc, nameFor(payAcc), gross, 0);
    }
    bump(detailMap, '600', nameFor('600'), 0, netAmount);
    if (vatAmount > 0) {
      bump(detailMap, '391', nameFor('391'), 0, vatAmount);
    }

    const cogs = computeSaleCogs(sale, products);
    if (cogs > 0) {
      bump(detailMap, '621', nameFor('621'), cogs, 0);
      bump(detailMap, '153', nameFor('153'), 0, cogs);
    }
  }

  for (const entry of periodReturns) {
    const gross = roundMoney(entry.refundTotal);
    const { netAmount, vatAmount } = splitGrossAmount(gross, vatRate);
    const payAcc = paymentAccountForReturn(entry);
    const skipPaymentSide = Boolean(
      entry.journalVoucherId && (payAcc === '102' || payAcc === '120'),
    );

    if (!skipPaymentSide) {
      bump(detailMap, payAcc, nameFor(payAcc), 0, gross);
    }
    bump(detailMap, '600', nameFor('600'), netAmount, 0);
    if (vatAmount > 0) {
      bump(detailMap, '391', nameFor('391'), vatAmount, 0);
    }

    const original = salesById.get(entry.originalSaleId);
    const cogs = computeReturnCogs(entry, original, products);
    if (cogs > 0) {
      bump(detailMap, '621', nameFor('621'), 0, cogs);
      bump(detailMap, '153', nameFor('153'), cogs, 0);
    }
  }

  return {
    salesCount: periodSales.length,
    returnsCount: periodReturns.length,
  };
}
