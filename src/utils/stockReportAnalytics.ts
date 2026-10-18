import type { StockAdjustment, StockAdjustmentType } from '../types/accounting';
import type { Product } from '../types/product';
import { buildStockValuation, filterAccountingByPeriod } from './accountingAnalytics';
import type { ReportPeriod } from './analytics';
import { formatReportDateLabel } from './analytics';
import { getCategoryLabel } from '../data/categories';
import { formatCurrency } from './format';

export interface StockChartRow {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  share: number;
}

export interface StockDailyTrendPoint {
  date: string;
  dateLabel: string;
  total: number;
}

export interface StockReportDashboard {
  valuation: ReturnType<typeof buildStockValuation>;
  inStockProductCount: number;
  outOfStockCount: number;
  periodAdjustmentCount: number;
  periodMovementValue: number;
  valueChart: StockChartRow[];
  categoryChart: StockChartRow[];
  adjustmentTypeChart: StockChartRow[];
  dailyAdjustmentTrend: StockDailyTrendPoint[];
}

const ADJUSTMENT_TYPE_LABELS: Record<StockAdjustmentType, string> = {
  count_diff: 'Sayım farkı',
  waste: 'Fire / zayi',
  fire: 'Fire',
  other: 'Diğer',
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toChartRows(
  rows: Array<{ key: string; label: string; value: number }>,
  format: (value: number) => string = formatCurrency,
): StockChartRow[] {
  const total = rows.reduce((sum, row) => sum + Math.abs(row.value), 0) || 1;
  return rows
    .filter((row) => row.value > 0)
    .map((row) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      displayValue: format(row.value),
      share: row.value / total,
    }))
    .sort((a, b) => b.value - a.value);
}

function buildCategoryChart(products: Product[]): StockChartRow[] {
  const totals = new Map<string, number>();
  for (const product of products) {
    if (product.stock <= 0) continue;
    const value = product.stock * product.purchasePrice;
    const cat = product.category ?? 'other';
    totals.set(cat, (totals.get(cat) ?? 0) + value);
  }
  return toChartRows(
    [...totals.entries()].map(([category, value]) => ({
      key: category,
      label: getCategoryLabel(category),
      value: roundMoney(value),
    })),
  );
}

function buildValueChart(valuation: ReturnType<typeof buildStockValuation>, limit = 12): StockChartRow[] {
  return toChartRows(
    valuation.rows.slice(0, limit).map((row) => ({
      key: String(row.productId),
      label: row.name,
      value: row.totalValue,
    })),
  );
}

function buildAdjustmentTypeChart(adjustments: StockAdjustment[]): StockChartRow[] {
  const totals = new Map<StockAdjustmentType, number>();
  for (const adj of adjustments) {
    const impact = Math.abs(adj.quantityDelta) * adj.unitCost;
    totals.set(adj.type, (totals.get(adj.type) ?? 0) + impact);
  }
  return toChartRows(
    [...totals.entries()].map(([type, value]) => ({
      key: type,
      label: ADJUSTMENT_TYPE_LABELS[type],
      value: roundMoney(value),
    })),
  );
}

function buildDailyAdjustmentTrend(adjustments: StockAdjustment[]): StockDailyTrendPoint[] {
  const byDay = new Map<string, number>();
  for (const adj of adjustments) {
    const day = adj.createdAt.slice(0, 10);
    const impact = Math.abs(adj.quantityDelta) * adj.unitCost;
    byDay.set(day, (byDay.get(day) ?? 0) + impact);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({
      date,
      dateLabel: formatReportDateLabel(date),
      total: roundMoney(total),
    }));
}

export function buildStockReportDashboard(
  products: Product[],
  stockAdjustments: StockAdjustment[],
  period: ReportPeriod,
): StockReportDashboard {
  const sellableProducts = products.filter((product) => !product.isSample);
  const valuation = buildStockValuation(sellableProducts);
  const inStockProductCount = sellableProducts.filter((product) => product.stock > 0).length;
  const outOfStockCount = sellableProducts.filter((product) => product.stock <= 0).length;

  const periodAdjustments = filterAccountingByPeriod(stockAdjustments, period, false, '', '');
  const periodAdjustmentCount = periodAdjustments.length;
  const periodMovementValue = roundMoney(
    periodAdjustments.reduce(
      (sum, adj) => sum + Math.abs(adj.quantityDelta) * adj.unitCost,
      0,
    ),
  );

  return {
    valuation,
    inStockProductCount,
    outOfStockCount,
    periodAdjustmentCount,
    periodMovementValue,
    valueChart: buildValueChart(valuation),
    categoryChart: buildCategoryChart(sellableProducts),
    adjustmentTypeChart: buildAdjustmentTypeChart(periodAdjustments),
    dailyAdjustmentTrend: buildDailyAdjustmentTrend(periodAdjustments),
  };
}
