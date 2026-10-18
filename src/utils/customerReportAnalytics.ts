import type { Customer } from '../types/business';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { AgingBucket, CustomerBalanceRow } from './accountingAnalytics';
import { buildCustomerAging, buildCustomerBalanceRows } from './accountingAnalytics';
import type { ReportPeriod } from './analytics';
import { formatCurrency } from './format';
import { filterSalesByPeriod } from './analytics';
import { resolveSaleCustomerId } from './saleCustomerLink';
import { getSaleNetTotal } from './saleReturn';

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface CustomerPeriodSalesRow {
  customerId: string;
  customerName: string;
  saleCount: number;
  periodTotal: number;
  creditSaleCount: number;
}

export interface CustomerReceivableSummary {
  totalReceivable: number;
  totalOverdue: number;
  customerWithBalanceCount: number;
}

export function buildCustomerPeriodSalesRows(
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
  period: ReportPeriod,
): CustomerPeriodSalesRow[] {
  const filteredSales = filterSalesByPeriod(sales, period);
  const map = new Map<string, CustomerPeriodSalesRow>();

  for (const sale of filteredSales) {
    const customerId = resolveSaleCustomerId(sale, customers);
    if (!customerId) continue;
    const customer = customers.find((item) => item.id === customerId);
    const netAmount = getSaleNetTotal(sale, saleReturns);
    if (netAmount <= 0) continue;

    const existing = map.get(customerId) ?? {
      customerId,
      customerName: customer?.name ?? sale.customerName?.trim() ?? 'Müşteri',
      saleCount: 0,
      periodTotal: 0,
      creditSaleCount: 0,
    };
    existing.saleCount += 1;
    existing.periodTotal += netAmount;
    if (sale.paymentMethod === 'credit') {
      existing.creditSaleCount += 1;
    }
    map.set(customerId, existing);
  }

  return [...map.values()]
    .map((row) => ({ ...row, periodTotal: roundMoney(row.periodTotal) }))
    .sort((a, b) => b.periodTotal - a.periodTotal);
}

export function summarizeCustomerReceivables(rows: CustomerBalanceRow[]): CustomerReceivableSummary {
  return {
    totalReceivable: roundMoney(rows.reduce((sum, row) => sum + row.balance, 0)),
    totalOverdue: roundMoney(rows.reduce((sum, row) => sum + row.overdueBalance, 0)),
    customerWithBalanceCount: rows.filter((row) => row.balance !== 0).length,
  };
}

export function sumCustomerPeriodSales(rows: CustomerPeriodSalesRow[]): {
  total: number;
  saleCount: number;
  customerCount: number;
} {
  return {
    total: roundMoney(rows.reduce((sum, row) => sum + row.periodTotal, 0)),
    saleCount: rows.reduce((sum, row) => sum + row.saleCount, 0),
    customerCount: rows.length,
  };
}

export interface CustomerChartRow {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  share: number;
}

export interface CustomerReportDashboard {
  customerRows: CustomerBalanceRow[];
  receivableSummary: CustomerReceivableSummary;
  periodSalesRows: CustomerPeriodSalesRow[];
  periodSalesSummary: ReturnType<typeof sumCustomerPeriodSales>;
  aging: AgingBucket[];
  agingChart: CustomerChartRow[];
  receivableChart: CustomerChartRow[];
  overdueChart: CustomerChartRow[];
  periodSalesChart: CustomerChartRow[];
}

function toChartRows(
  rows: Array<{ key: string; label: string; value: number }>,
): CustomerChartRow[] {
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      displayValue: formatCurrency(row.value),
      share: row.value / total,
    }))
    .sort((a, b) => b.value - a.value);
}

export function buildCustomerReportDashboard(
  customers: Customer[],
  customerLedger: Parameters<typeof buildCustomerBalanceRows>[1],
  sales: Sale[],
  saleReturns: SaleReturn[],
  period: ReportPeriod,
): CustomerReportDashboard {
  const customerRows = buildCustomerBalanceRows(
    customers.map((c) => ({ id: c.id, name: c.name })),
    customerLedger,
  );
  const receivableSummary = summarizeCustomerReceivables(customerRows);
  const periodSalesRows = buildCustomerPeriodSalesRows(sales, saleReturns, customers, period);
  const periodSalesSummary = sumCustomerPeriodSales(periodSalesRows);
  const aging = buildCustomerAging(customerLedger);

  const agingChart = toChartRows(
    aging.map((bucket) => ({
      key: bucket.label,
      label: bucket.label,
      value: bucket.amount,
    })),
  );

  const receivableChart = toChartRows(
    customerRows.map((row) => ({
      key: row.customerId,
      label: row.customerName,
      value: row.balance,
    })),
  );

  const overdueChart = toChartRows(
    customerRows
      .filter((row) => row.overdueBalance > 0)
      .map((row) => ({
        key: row.customerId,
        label: row.customerName,
        value: row.overdueBalance,
      })),
  );

  const periodSalesChart = toChartRows(
    periodSalesRows.map((row) => ({
      key: row.customerId,
      label: row.customerName,
      value: row.periodTotal,
    })),
  );

  return {
    customerRows,
    receivableSummary,
    periodSalesRows,
    periodSalesSummary,
    aging,
    agingChart,
    receivableChart,
    overdueChart,
    periodSalesChart,
  };
}
