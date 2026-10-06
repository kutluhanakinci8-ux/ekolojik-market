import type { EquityPartner, StockAdjustment } from '../types/accounting';
import type { Expense } from '../types/business';
import type { Product, Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { buildProfitLossForReportPeriod, buildProfitLossReport } from './accountingAnalytics';
import type { ReportPeriod } from './analytics';
import { formatReportDateLabel } from './analytics';
import { trialBalancePeriodLabel } from './trialBalance';
import { filterSalesByDateRange } from './analytics';
import { filterReturnsByDateRange } from './saleReturn';

function isoDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getCalendarMonthRange(reference = new Date()): { from: string; to: string } {
  const from = isoDateLocal(new Date(reference.getFullYear(), reference.getMonth(), 1));
  const to = isoDateLocal(reference);
  return { from, to };
}

export function getCalendarYearRange(reference = new Date()): { from: string; to: string } {
  const from = isoDateLocal(new Date(reference.getFullYear(), 0, 1));
  const to = isoDateLocal(reference);
  return { from, to };
}

function filterByCreatedAtRange<T extends { createdAt: string }>(
  items: T[],
  from: string,
  to: string,
): T[] {
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59.999`);
  return items.filter((item) => {
    const createdAt = new Date(item.createdAt);
    return createdAt >= start && createdAt <= end;
  });
}

export function buildProfitLossForDateRange(
  from: string,
  to: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
  expenses: Expense[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
) {
  const filteredSales = filterSalesByDateRange(sales, from, to);
  const filteredReturns = filterReturnsByDateRange(saleReturns, from, to);
  const filteredExpenses = filterByCreatedAtRange(expenses, from, to);
  const filteredAdjustments = filterByCreatedAtRange(stockAdjustments, from, to);
  return buildProfitLossReport(
    filteredSales,
    filteredReturns,
    filteredExpenses,
    products,
    filteredAdjustments,
  );
}

export interface PartnerProfitShareRow {
  partnerId: string;
  partnerName: string;
  accountCode: string;
  country: string;
  sharePercent: number;
  monthlyShare: number;
  yearlyShare: number;
  projectedYearlyFromMonth: number;
}

export interface PartnerProfitBasis {
  netRevenue: number;
  cogs: number;
  operatingExpenses: number;
  netProfit: number;
}

export interface PartnerProfitSharePreview {
  periodLabel: string;
  monthRange: { from: string; to: string };
  yearRange: { from: string; to: string };
  periodBasis: PartnerProfitBasis;
  yearBasis: PartnerProfitBasis;
  netProfitMonth: number;
  netProfitYear: number;
  totalSharePercent: number;
  sharePercentComplete: boolean;
  rows: PartnerProfitShareRow[];
  monthlyShareTotal: number;
  yearlyShareTotal: number;
  projectedYearlyFromMonthTotal: number;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function shareAmount(netProfit: number, sharePercent: number, zeroOnLoss: boolean): number {
  if (sharePercent <= 0) return 0;
  if (zeroOnLoss && netProfit <= 0) return 0;
  return roundMoney(netProfit * (sharePercent / 100));
}

function basisFromPl(pl: {
  netRevenue: number;
  cogs: number;
  operatingExpenses: number;
  netProfit: number;
}): PartnerProfitBasis {
  return {
    netRevenue: roundMoney(pl.netRevenue),
    cogs: roundMoney(pl.cogs),
    operatingExpenses: roundMoney(pl.operatingExpenses),
    netProfit: roundMoney(pl.netProfit),
  };
}

export function buildPartnerProfitSharePreviewFromReports(
  partners: EquityPartner[],
  period: ReportPeriod,
  sales: Sale[],
  saleReturns: SaleReturn[],
  expenses: Expense[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
  options?: { zeroShareOnLoss?: boolean },
): PartnerProfitSharePreview {
  const yearRange = getCalendarYearRange();
  const plPeriod = buildProfitLossForReportPeriod(
    period,
    sales,
    saleReturns,
    expenses,
    products,
    stockAdjustments,
  );
  const plYear = buildProfitLossForDateRange(
    yearRange.from,
    yearRange.to,
    sales,
    saleReturns,
    expenses,
    products,
    stockAdjustments,
  );
  const periodRange = reportPeriodDateRange(period);
  return buildPartnerProfitSharePreview(
    partners,
    plPeriod.netProfit,
    plYear.netProfit,
    periodRange,
    yearRange,
    {
      zeroShareOnLoss: options?.zeroShareOnLoss,
      periodLabel: trialBalancePeriodLabel(period),
      periodBasis: basisFromPl(plPeriod),
      yearBasis: basisFromPl(plYear),
    },
  );
}

export function reportPeriodDateRange(period: ReportPeriod): { from: string; to: string } {
  const to = isoDateLocal(new Date());
  if (period === 'all') {
    return { from: to, to };
  }
  const start = new Date();
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === 'week') start.setDate(start.getDate() - 7);
  else start.setMonth(start.getMonth() - 1);
  return { from: isoDateLocal(start), to };
}

export function buildPartnerProfitSharePreview(
  partners: EquityPartner[],
  netProfitMonth: number,
  netProfitYear: number,
  monthRange: { from: string; to: string },
  yearRange: { from: string; to: string },
  options?: {
    zeroShareOnLoss?: boolean;
    periodLabel?: string;
    periodBasis?: PartnerProfitBasis;
    yearBasis?: PartnerProfitBasis;
  },
): PartnerProfitSharePreview {
  const zeroOnLoss = options?.zeroShareOnLoss ?? true;
  const active = partners.filter((p) => p.isActive);
  const totalSharePercent = roundMoney(
    active.reduce((sum, p) => sum + (p.sharePercent ?? 0), 0),
  );

  const rows: PartnerProfitShareRow[] = active.map((partner) => {
    const sharePercent = partner.sharePercent ?? 0;
    const monthlyShare = shareAmount(netProfitMonth, sharePercent, zeroOnLoss);
    const yearlyShare = shareAmount(netProfitYear, sharePercent, zeroOnLoss);
    const simpleProjected = monthlyShare > 0 ? roundMoney(monthlyShare * 12) : 0;

    return {
      partnerId: partner.id,
      partnerName: partner.name,
      accountCode: partner.accountCode,
      country: partner.country,
      sharePercent,
      monthlyShare,
      yearlyShare,
      projectedYearlyFromMonth: simpleProjected,
    };
  });

  const emptyBasis: PartnerProfitBasis = {
    netRevenue: 0,
    cogs: 0,
    operatingExpenses: 0,
    netProfit: 0,
  };

  return {
    periodLabel: options?.periodLabel ?? 'Seçili dönem',
    monthRange,
    yearRange,
    periodBasis: options?.periodBasis ?? emptyBasis,
    yearBasis: options?.yearBasis ?? emptyBasis,
    netProfitMonth: roundMoney(netProfitMonth),
    netProfitYear: roundMoney(netProfitYear),
    totalSharePercent,
    sharePercentComplete: Math.abs(totalSharePercent - 100) < 0.01,
    rows,
    monthlyShareTotal: roundMoney(rows.reduce((sum, r) => sum + r.monthlyShare, 0)),
    yearlyShareTotal: roundMoney(rows.reduce((sum, r) => sum + r.yearlyShare, 0)),
    projectedYearlyFromMonthTotal: roundMoney(rows.reduce((sum, r) => sum + r.projectedYearlyFromMonth, 0)),
  };
}

/** Ortak paneli için özet (şimdilik yalnızca şirket tarafı önizleme ile aynı veri) */
export function buildPartnerProfitShareForPartner(
  preview: PartnerProfitSharePreview,
  partnerId: string,
): PartnerProfitShareRow | undefined {
  return preview.rows.find((row) => row.partnerId === partnerId);
}

export function formatPartnerProfitRangeLabel(from: string, to: string): string {
  if (from === to) return formatReportDateLabel(from);
  return `${formatReportDateLabel(from)} – ${formatReportDateLabel(to)}`;
}
