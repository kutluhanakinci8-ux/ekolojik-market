import type {
  BankAccount,
  BankTransaction,
  CashCountVariance,
  CheckNote,
  CustomerLedgerEntry,
  PeriodClosure,
  StockAdjustment,
  Supplier,
  SupplierLedgerEntry,
} from '../types/accounting';
import type { Expense, PurchaseInvoice } from '../types/business';
import type { Product, Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { ReportPeriod } from './analytics';
import { filterSalesByDateRange, filterSalesByPeriod } from './analytics';
import { filterReturnsByDateRange, filterReturnsByPeriod } from './saleReturn';
import {
  calculateVatSummary,
  DEFAULT_VAT_RATE,
  filterInvoicesByDateRange,
  filterInvoicesByPeriod,
  roundMoney,
  sumReturnsNetFromGrossTotals,
  sumSalesNetFromGrossTotals,
} from './vatAnalytics';

export interface CustomerBalanceRow {
  customerId: string;
  customerName: string;
  balance: number;
  overdueBalance: number;
  lastActivityAt?: string;
}

export interface SupplierBalanceRow {
  supplierId: string;
  supplierName: string;
  balance: number;
  overdueBalance: number;
  lastActivityAt?: string;
}

export interface AgingBucket {
  label: string;
  amount: number;
}

export interface CustomerStatementRow {
  id: string;
  date: string;
  type: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
}

export type SupplierStatementRow = CustomerStatementRow;

export interface ProfitLossReport {
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  expenseByCategory: { category: string; label: string; total: number }[];
  netProfit: number;
  grossMargin: number;
}

export interface StockValuationRow {
  productId: number;
  name: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export interface LedgerDebitCreditTotals {
  debit: number;
  credit: number;
  balance: number;
}

function sumLedgerDebitCredit(entries: Array<{ amount: number }>): LedgerDebitCreditTotals {
  let debit = 0;
  let credit = 0;
  for (const entry of entries) {
    if (entry.amount > 0) debit += entry.amount;
    else if (entry.amount < 0) credit += Math.abs(entry.amount);
  }
  const round = (value: number) => Math.round(value * 100) / 100;
  return {
    debit: round(debit),
    credit: round(credit),
    balance: round(debit - credit),
  };
}

export function getCustomerLedgerTotals(entries: CustomerLedgerEntry[]): LedgerDebitCreditTotals {
  return sumLedgerDebitCredit(entries);
}

export function getSupplierLedgerTotals(entries: SupplierLedgerEntry[]): LedgerDebitCreditTotals {
  return sumLedgerDebitCredit(entries);
}

export function getCustomerBalance(entries: CustomerLedgerEntry[]): number {
  return getCustomerLedgerTotals(entries).balance;
}

export function getSupplierBalance(entries: SupplierLedgerEntry[]): number {
  return getSupplierLedgerTotals(entries).balance;
}

export function getCustomerOverdueBalance(
  entries: CustomerLedgerEntry[],
  asOf = todayKey(),
): number {
  return entries
    .filter((entry) => entry.amount > 0 && entry.dueDate && entry.dueDate < asOf)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function getSupplierOverdueBalance(
  entries: SupplierLedgerEntry[],
  asOf = todayKey(),
): number {
  return entries
    .filter((entry) => entry.amount > 0 && entry.dueDate && entry.dueDate < asOf)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

export function buildCustomerBalanceRows(
  customerIds: { id: string; name: string }[],
  ledger: CustomerLedgerEntry[],
): CustomerBalanceRow[] {
  const rows: CustomerBalanceRow[] = [];
  for (const customer of customerIds) {
    const entries = ledger.filter((entry) => entry.customerId === customer.id);
    const balance = getCustomerBalance(entries);
    if (balance === 0 && entries.length === 0) continue;
    const sorted = entries.map((entry) => entry.createdAt).sort((a, b) => b.localeCompare(a));
    rows.push({
      customerId: customer.id,
      customerName: customer.name,
      balance,
      overdueBalance: getCustomerOverdueBalance(entries),
      lastActivityAt: sorted[0],
    });
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

export function buildSupplierBalanceRows(
  suppliers: Supplier[],
  ledger: SupplierLedgerEntry[],
): SupplierBalanceRow[] {
  const rows: SupplierBalanceRow[] = [];
  for (const supplier of suppliers) {
    const entries = ledger.filter((entry) => entry.supplierId === supplier.id);
    const balance = getSupplierBalance(entries);
    if (balance === 0 && entries.length === 0) continue;
    const sorted = entries.map((entry) => entry.createdAt).sort((a, b) => b.localeCompare(a));
    rows.push({
      supplierId: supplier.id,
      supplierName: supplier.name,
      balance,
      overdueBalance: getSupplierOverdueBalance(entries),
      lastActivityAt: sorted[0],
    });
  }
  return rows.sort((a, b) => b.balance - a.balance);
}

export function buildCustomerAging(
  ledger: CustomerLedgerEntry[],
  asOf = todayKey(),
): AgingBucket[] {
  const buckets = {
    current: 0,
    d30: 0,
    d60: 0,
    d90: 0,
    d90plus: 0,
  };

  const openEntries = ledger.filter((entry) => entry.amount > 0);
  for (const entry of openEntries) {
    if (!entry.dueDate || entry.dueDate >= asOf) {
      buckets.current += entry.amount;
      continue;
    }
    const due = new Date(`${entry.dueDate}T12:00:00`);
    const ref = new Date(`${asOf}T12:00:00`);
    const days = Math.floor((ref.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 30) buckets.d30 += entry.amount;
    else if (days <= 60) buckets.d60 += entry.amount;
    else if (days <= 90) buckets.d90 += entry.amount;
    else buckets.d90plus += entry.amount;
  }

  return [
    { label: 'Vadesi gelmemiş', amount: buckets.current },
    { label: '1–30 gün', amount: buckets.d30 },
    { label: '31–60 gün', amount: buckets.d60 },
    { label: '61–90 gün', amount: buckets.d90 },
    { label: '90+ gün', amount: buckets.d90plus },
  ];
}

export function buildCustomerStatement(
  customerId: string,
  ledger: CustomerLedgerEntry[],
): CustomerStatementRow[] {
  const entries = ledger
    .filter((entry) => entry.customerId === customerId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let balance = 0;
  return entries.map((entry) => {
    const debit = entry.amount > 0 ? entry.amount : 0;
    const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0;
    balance += entry.amount;
    const paymentLabel = entry.paymentMethod
      ? ({ cash: 'Nakit', card: 'Kart', transfer: 'Havale', check: 'Çek' } as const)[entry.paymentMethod]
      : undefined;
    const typeLabel =
      entry.type === 'sale' ? `Satış${paymentLabel ? ` (${paymentLabel})` : ''}`
        : entry.type === 'sale_credit' ? 'Veresiye Satış'
          : entry.type === 'payment' ? `Tahsilat${paymentLabel ? ` (${paymentLabel})` : ''}`
            : entry.type === 'return' ? 'İade'
              : 'Düzeltme';
    return {
      id: entry.id,
      date: entry.createdAt,
      type: typeLabel,
      reference: entry.reference ?? entry.saleId,
      debit,
      credit,
      balance,
    };
  });
}

export function buildSupplierStatement(
  supplierId: string,
  ledger: SupplierLedgerEntry[],
): SupplierStatementRow[] {
  const entries = ledger
    .filter((entry) => entry.supplierId === supplierId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let balance = 0;
  return entries.map((entry) => {
    const debit = entry.amount > 0 ? entry.amount : 0;
    const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0;
    balance += entry.amount;
    const paymentLabel = entry.paymentMethod
      ? ({ cash: 'Nakit', transfer: 'Havale', check: 'Çek' } as const)[entry.paymentMethod]
      : undefined;
    const typeLabel =
      entry.type === 'invoice' ? 'Alış Faturası'
        : entry.type === 'payment' ? `Ödeme${paymentLabel ? ` (${paymentLabel})` : ''}`
          : 'Düzeltme';
    return {
      id: entry.id,
      date: entry.createdAt,
      type: typeLabel,
      reference: entry.reference ?? entry.purchaseInvoiceId ?? entry.note,
      debit,
      credit,
      balance,
    };
  });
}

export function getBankAccountBalance(
  account: BankAccount,
  transactions: BankTransaction[],
): number {
  const movement = transactions
    .filter((tx) => tx.bankAccountId === account.id)
    .reduce((sum, tx) => sum + tx.amount, 0);
  return account.openingBalance + movement;
}

export function calculateCogs(
  sales: Sale[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
): number {
  let cogs = 0;
  for (const sale of sales) {
    for (const item of sale.items) {
      if (item.productId == null) continue;
      const product = products.find((p) => p.id === item.productId);
      cogs += (product?.purchasePrice ?? 0) * item.quantity;
    }
  }
  for (const adj of stockAdjustments) {
    if (adj.quantityDelta < 0) {
      cogs += Math.abs(adj.quantityDelta) * adj.unitCost;
    }
  }
  return Math.round(cogs * 100) / 100;
}

const EXPENSE_CATEGORY_LABELS: Record<Expense['category'], string> = {
  rent: 'Kira',
  utilities: 'Fatura / Enerji',
  supplies: 'Malzeme',
  salary: 'Personel',
  other: 'Diğer',
};

export function buildProfitLossReport(
  sales: Sale[],
  saleReturns: SaleReturn[],
  expenses: Expense[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
  vatRate = DEFAULT_VAT_RATE,
): ProfitLossReport {
  const salesNet = sumSalesNetFromGrossTotals(sales, vatRate);
  const returnsNet = sumReturnsNetFromGrossTotals(saleReturns, vatRate);
  const netRevenue = roundMoney(salesNet - returnsNet);
  const cogs = calculateCogs(sales, products, stockAdjustments);
  const grossProfit = netRevenue - cogs;

  const categoryMap = new Map<string, number>();
  for (const expense of expenses) {
    categoryMap.set(expense.category, (categoryMap.get(expense.category) ?? 0) + expense.amount);
  }
  const expenseByCategory = [...categoryMap.entries()].map(([category, total]) => ({
    category,
    label: EXPENSE_CATEGORY_LABELS[category as Expense['category']] ?? category,
    total,
  }));
  const operatingExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const netProfit = grossProfit - operatingExpenses;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  return {
    netRevenue,
    cogs,
    grossProfit,
    operatingExpenses,
    expenseByCategory,
    netProfit,
    grossMargin,
  };
}

export function buildProfitLossForReportPeriod(
  period: ReportPeriod,
  sales: Sale[],
  saleReturns: SaleReturn[],
  expenses: Expense[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
) {
  const filteredSales = filterSalesByPeriod(sales, period);
  const filteredReturns = filterReturnsByPeriod(saleReturns, period);
  const filteredExpenses = filterAccountingByPeriod(expenses, period, false, '', '');
  const filteredAdjustments = filterAccountingByPeriod(stockAdjustments, period, false, '', '');
  return buildProfitLossReport(
    filteredSales,
    filteredReturns,
    filteredExpenses,
    products,
    filteredAdjustments,
  );
}

export function buildStockValuation(products: Product[]): {
  rows: StockValuationRow[];
  totalValue: number;
  totalUnits: number;
} {
  const rows = products
    .filter((product) => product.stock > 0)
    .map((product) => ({
      productId: product.id,
      name: product.name,
      quantity: product.stock,
      unitCost: product.purchasePrice,
      totalValue: product.stock * product.purchasePrice,
    }))
    .sort((a, b) => b.totalValue - a.totalValue);

  return {
    rows,
    totalValue: rows.reduce((sum, row) => sum + row.totalValue, 0),
    totalUnits: rows.reduce((sum, row) => sum + row.quantity, 0),
  };
}

export function filterAccountingByPeriod<T extends { createdAt: string }>(
  items: T[],
  period: ReportPeriod,
  useCustomRange: boolean,
  dateFrom: string,
  dateTo: string,
): T[] {
  if (useCustomRange && dateFrom && dateTo) {
    const start = new Date(`${dateFrom}T00:00:00`);
    const end = new Date(`${dateTo}T23:59:59.999`);
    return items.filter((item) => {
      const createdAt = new Date(item.createdAt);
      return createdAt >= start && createdAt <= end;
    });
  }

  const now = new Date();
  const start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === 'week') start.setDate(now.getDate() - 7);
  else if (period === 'month') start.setMonth(now.getMonth() - 1);
  else return items;

  return items.filter((item) => new Date(item.createdAt) >= start);
}

export function buildPeriodClosureSnapshot(
  period: ReportPeriod,
  useCustomRange: boolean,
  dateFrom: string,
  dateTo: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
  expenses: Expense[],
  purchaseInvoices: PurchaseInvoice[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
  customerLedger: CustomerLedgerEntry[],
  supplierLedger: SupplierLedgerEntry[],
): PeriodClosure['snapshot'] {
  const filteredSales = useCustomRange && dateFrom && dateTo
    ? filterSalesByDateRange(sales, dateFrom, dateTo)
    : filterSalesByPeriod(sales, period);
  const filteredReturns = useCustomRange && dateFrom && dateTo
    ? filterReturnsByDateRange(saleReturns, dateFrom, dateTo)
    : filterReturnsByPeriod(saleReturns, period);
  const filteredExpenses = filterAccountingByPeriod(expenses, period, useCustomRange, dateFrom, dateTo);
  const filteredInvoices = useCustomRange && dateFrom && dateTo
    ? filterInvoicesByDateRange(purchaseInvoices, dateFrom, dateTo)
    : filterInvoicesByPeriod(purchaseInvoices, period);
  const filteredAdjustments = filterAccountingByPeriod(
    stockAdjustments,
    period,
    useCustomRange,
    dateFrom,
    dateTo,
  );

  const pl = buildProfitLossReport(
    filteredSales,
    filteredReturns,
    filteredExpenses,
    products,
    filteredAdjustments,
  );
  const stock = buildStockValuation(products);
  const vat = calculateVatSummary(filteredSales, filteredInvoices);

  return {
    netRevenue: pl.netRevenue,
    cogs: pl.cogs,
    grossProfit: pl.grossProfit,
    operatingExpenses: pl.operatingExpenses,
    netProfit: pl.netProfit,
    receivables: getCustomerBalance(customerLedger),
    payables: getSupplierBalance(supplierLedger),
    stockValue: stock.totalValue,
    vatPayable: vat.payableVat > 0 ? vat.payableVat : 0,
  };
}

export function getPendingChecksTotal(checkNotes: CheckNote[]): number {
  return checkNotes
    .filter((note) => note.status === 'pending')
    .reduce((sum, note) => sum + note.amount, 0);
}

export function getCashVarianceTotal(variances: CashCountVariance[]): number {
  return variances.reduce((sum, row) => sum + row.variance, 0);
}
