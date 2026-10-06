import type { Expense } from '../types/business';
import type { Product, Sale } from '../types/product';
import type { StockAdjustment } from '../types/accounting';
import type { SaleReturn } from '../types/saleReturn';
import {
  buildProfitLossForReportPeriod,
  type ProfitLossReport,
} from './accountingAnalytics';
import {
  filterSalesByPeriod,
  formatReportDateLabel,
  getCategoryRevenue,
  getPaymentBreakdown,
  type ReportPeriod,
} from './analytics';
import { formatCurrency } from './format';
import { filterReturnsByPeriod, getSaleNetTotal } from './saleReturn';

export interface IncomeChartRow {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  share: number;
}

export interface IncomeDailyTrendPoint {
  date: string;
  dateLabel: string;
  total: number;
}

export interface IncomeReportDashboard {
  profitLoss: ProfitLossReport;
  saleCount: number;
  returnCount: number;
  returnsGrossTotal: number;
  netMarginPercent: number;
  structureChart: IncomeChartRow[];
  paymentChart: IncomeChartRow[];
  categoryChart: IncomeChartRow[];
  dailyTrend: IncomeDailyTrendPoint[];
}

const PAYMENT_LABELS: Record<'cash' | 'card' | 'transfer' | 'credit', string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  credit: 'Veresiye',
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toChartRows(
  rows: Array<{ key: string; label: string; value: number }>,
): IncomeChartRow[] {
  const total = rows.reduce((sum, row) => sum + Math.abs(row.value), 0) || 1;
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

function buildStructureChart(profitLoss: ProfitLossReport): IncomeChartRow[] {
  return toChartRows([
    { key: 'revenue', label: 'Net satış', value: profitLoss.netRevenue },
    { key: 'cogs', label: 'Satılan malın maliyeti (SMM)', value: profitLoss.cogs },
    { key: 'gross', label: 'Brüt kâr', value: profitLoss.grossProfit },
    { key: 'opex', label: 'Faaliyet giderleri', value: profitLoss.operatingExpenses },
    { key: 'net', label: 'Net kâr', value: Math.max(0, profitLoss.netProfit) },
  ]);
}

function buildPaymentChart(sales: Sale[], saleReturns: SaleReturn[]): IncomeChartRow[] {
  const breakdown = getPaymentBreakdown(sales, saleReturns);
  return toChartRows(
    (Object.keys(breakdown) as Array<keyof typeof breakdown>).map((key) => ({
      key,
      label: PAYMENT_LABELS[key],
      value: Math.max(0, breakdown[key]),
    })),
  );
}

function buildCategoryChart(sales: Sale[], products: Product[]): IncomeChartRow[] {
  const rows = getCategoryRevenue(sales, products);
  return toChartRows(
    rows.map((row) => ({
      key: row.category,
      label: row.label,
      value: row.total,
    })),
  );
}

function buildDailyTrend(
  sales: Sale[],
  saleReturns: SaleReturn[],
  period: ReportPeriod,
): IncomeDailyTrendPoint[] {
  const filtered = filterSalesByPeriod(sales, period);
  const byDay = new Map<string, number>();

  for (const sale of filtered) {
    const day = sale.createdAt.slice(0, 10);
    const net = getSaleNetTotal(sale, saleReturns);
    if (net <= 0) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + net);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({
      date,
      dateLabel: formatReportDateLabel(date),
      total: roundMoney(total),
    }));
}

export function buildIncomeReportDashboard(
  sales: Sale[],
  saleReturns: SaleReturn[],
  expenses: Expense[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
  period: ReportPeriod,
): IncomeReportDashboard {
  const filteredSales = filterSalesByPeriod(sales, period);
  const filteredReturns = filterReturnsByPeriod(saleReturns, period);
  const profitLoss = buildProfitLossForReportPeriod(
    period,
    sales,
    saleReturns,
    expenses,
    products,
    stockAdjustments,
  );

  const returnsGrossTotal = roundMoney(
    filteredReturns.reduce((sum, row) => sum + row.refundTotal, 0),
  );

  const netMarginPercent = profitLoss.netRevenue > 0
    ? (profitLoss.netProfit / profitLoss.netRevenue) * 100
    : 0;

  return {
    profitLoss,
    saleCount: filteredSales.length,
    returnCount: filteredReturns.length,
    returnsGrossTotal,
    netMarginPercent,
    structureChart: buildStructureChart(profitLoss),
    paymentChart: buildPaymentChart(filteredSales, filteredReturns),
    categoryChart: buildCategoryChart(filteredSales, products),
    dailyTrend: buildDailyTrend(sales, saleReturns, period),
  };
}
