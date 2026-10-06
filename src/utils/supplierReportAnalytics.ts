import type { PurchaseInvoice } from '../types/business';
import type { Supplier, SupplierLedgerEntry } from '../types/accounting';
import type { ReportPeriod } from './analytics';
import {
  buildSupplierBalanceRows,
  filterAccountingByPeriod,
  type SupplierBalanceRow,
} from './accountingAnalytics';
import { filterInvoicesByPeriod } from './vatAnalytics';
import { formatCurrency } from './format';

export interface SupplierChartRow {
  supplierId: string;
  label: string;
  value: number;
  displayValue: string;
  share: number;
}

export interface SupplierReportDashboard {
  balanceRows: SupplierBalanceRow[];
  totalDebt: number;
  totalOverdue: number;
  supplierWithDebtCount: number;
  periodPurchaseTotal: number;
  periodPaymentTotal: number;
  periodInvoiceCount: number;
  debtChart: SupplierChartRow[];
  overdueChart: SupplierChartRow[];
  periodPurchaseChart: SupplierChartRow[];
  periodPaymentChart: SupplierChartRow[];
}

function supplierName(suppliers: Supplier[], supplierId: string): string {
  return suppliers.find((item) => item.id === supplierId)?.name ?? 'Tedarikçi';
}

function toChartRows(
  rows: Array<{ supplierId: string; label: string; value: number }>,
  format: (value: number) => string = formatCurrency,
): SupplierChartRow[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      supplierId: row.supplierId,
      label: row.label,
      value: row.value,
      displayValue: format(row.value),
      share: row.value / total,
    }))
    .sort((a, b) => b.value - a.value);
}

function sumPeriodLedgerBySupplier(
  ledger: SupplierLedgerEntry[],
): { purchases: Map<string, number>; payments: Map<string, number> } {
  const purchases = new Map<string, number>();
  const payments = new Map<string, number>();

  for (const entry of ledger) {
    if (entry.type === 'invoice' && entry.amount > 0) {
      purchases.set(entry.supplierId, (purchases.get(entry.supplierId) ?? 0) + entry.amount);
    }
    if (entry.amount < 0) {
      payments.set(entry.supplierId, (payments.get(entry.supplierId) ?? 0) + Math.abs(entry.amount));
    }
  }

  return { purchases, payments };
}

export function buildSupplierReportDashboard(
  suppliers: Supplier[],
  supplierLedger: SupplierLedgerEntry[],
  purchaseInvoices: PurchaseInvoice[],
  period: ReportPeriod,
): SupplierReportDashboard {
  const balanceRows = buildSupplierBalanceRows(suppliers, supplierLedger);
  const totalDebt = balanceRows.reduce((sum, row) => sum + row.balance, 0);
  const totalOverdue = balanceRows.reduce((sum, row) => sum + row.overdueBalance, 0);

  const periodLedger = filterAccountingByPeriod(supplierLedger, period, false, '', '');
  const { purchases, payments } = sumPeriodLedgerBySupplier(periodLedger);

  const periodPurchaseTotal = [...purchases.values()].reduce((sum, value) => sum + value, 0);
  const periodPaymentTotal = [...payments.values()].reduce((sum, value) => sum + value, 0);
  const periodInvoiceCount = filterInvoicesByPeriod(purchaseInvoices, period).length;

  const debtChart = toChartRows(
    balanceRows.map((row) => ({
      supplierId: row.supplierId,
      label: row.supplierName,
      value: row.balance,
    })),
  );

  const overdueChart = toChartRows(
    balanceRows
      .filter((row) => row.overdueBalance > 0)
      .map((row) => ({
        supplierId: row.supplierId,
        label: row.supplierName,
        value: row.overdueBalance,
      })),
  );

  const periodPurchaseChart = toChartRows(
    [...purchases.entries()].map(([supplierId, value]) => ({
      supplierId,
      label: supplierName(suppliers, supplierId),
      value,
    })),
  );

  const periodPaymentChart = toChartRows(
    [...payments.entries()].map(([supplierId, value]) => ({
      supplierId,
      label: supplierName(suppliers, supplierId),
      value,
    })),
  );

  return {
    balanceRows,
    totalDebt,
    totalOverdue,
    supplierWithDebtCount: balanceRows.length,
    periodPurchaseTotal,
    periodPaymentTotal,
    periodInvoiceCount,
    debtChart,
    overdueChart,
    periodPurchaseChart,
    periodPaymentChart,
  };
}
