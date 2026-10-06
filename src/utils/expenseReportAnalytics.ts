import type { CustomExpenseCategory, Expense } from '../types/business';
import type { Product, Sale } from '../types/product';
import type { StockAdjustment } from '../types/accounting';
import type { SaleReturn } from '../types/saleReturn';
import {
  buildProfitLossForReportPeriod,
  filterAccountingByPeriod,
  type ProfitLossReport,
} from './accountingAnalytics';
import type { ReportPeriod } from './analytics';
import { formatReportDateLabel } from './analytics';
import { getExpenseCategoryLabel } from './expenseCategories';
import { formatCurrency } from './format';

export interface ExpenseChartRow {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  share: number;
}

export interface ExpenseDailyTrendPoint {
  date: string;
  dateLabel: string;
  total: number;
}

export interface ExpenseReportDashboard {
  profitLoss: ProfitLossReport;
  expenses: Expense[];
  totalExpenses: number;
  expenseCount: number;
  averageExpense: number;
  totalVat: number;
  expenseToRevenuePercent: number;
  categoryChart: ExpenseChartRow[];
  dailyTrend: ExpenseDailyTrendPoint[];
  supplierChart: ExpenseChartRow[];
  topExpenseChart: ExpenseChartRow[];
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function expenseDateKey(expense: Expense): string {
  return (expense.businessDate ?? expense.createdAt).slice(0, 10);
}

function toChartRows(
  rows: Array<{ key: string; label: string; value: number }>,
): ExpenseChartRow[] {
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

function buildCategoryChart(
  expenses: Expense[],
  customCategories: CustomExpenseCategory[],
): ExpenseChartRow[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount);
  }
  return toChartRows(
    [...totals.entries()].map(([category, value]) => ({
      key: category,
      label: getExpenseCategoryLabel(category, customCategories),
      value,
    })),
  );
}

function buildDailyTrend(expenses: Expense[]): ExpenseDailyTrendPoint[] {
  const byDay = new Map<string, number>();
  for (const expense of expenses) {
    const day = expenseDateKey(expense);
    byDay.set(day, (byDay.get(day) ?? 0) + expense.amount);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, total]) => ({
      date,
      dateLabel: formatReportDateLabel(date),
      total: roundMoney(total),
    }));
}

function buildSupplierChart(expenses: Expense[]): ExpenseChartRow[] {
  const totals = new Map<string, number>();
  for (const expense of expenses) {
    const name = expense.supplierName?.trim();
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + expense.amount);
  }
  return toChartRows(
    [...totals.entries()].map(([name, value]) => ({
      key: name,
      label: name,
      value,
    })),
  );
}

function buildTopExpenseChart(expenses: Expense[], limit = 8): ExpenseChartRow[] {
  const sorted = [...expenses].sort((a, b) => b.amount - a.amount).slice(0, limit);
  return toChartRows(
    sorted.map((expense) => ({
      key: expense.id,
      label: expense.description?.trim() || expense.documentNo || 'Gider',
      value: expense.amount,
    })),
  );
}

export function buildExpenseReportDashboard(
  sales: Sale[],
  saleReturns: SaleReturn[],
  expenses: Expense[],
  products: Product[],
  stockAdjustments: StockAdjustment[],
  customCategories: CustomExpenseCategory[],
  period: ReportPeriod,
): ExpenseReportDashboard {
  const filteredExpenses = filterAccountingByPeriod(expenses, period, false, '', '');
  const profitLoss = buildProfitLossForReportPeriod(
    period,
    sales,
    saleReturns,
    expenses,
    products,
    stockAdjustments,
  );

  const totalExpenses = roundMoney(filteredExpenses.reduce((sum, row) => sum + row.amount, 0));
  const expenseCount = filteredExpenses.length;
  const averageExpense = expenseCount > 0 ? roundMoney(totalExpenses / expenseCount) : 0;
  const totalVat = roundMoney(
    filteredExpenses.reduce((sum, row) => sum + (row.vatAmount ?? 0), 0),
  );
  const expenseToRevenuePercent = profitLoss.netRevenue > 0
    ? (totalExpenses / profitLoss.netRevenue) * 100
    : 0;

  return {
    profitLoss,
    expenses: [...filteredExpenses].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    totalExpenses,
    expenseCount,
    averageExpense,
    totalVat,
    expenseToRevenuePercent,
    categoryChart: buildCategoryChart(filteredExpenses, customCategories),
    dailyTrend: buildDailyTrend(filteredExpenses),
    supplierChart: buildSupplierChart(filteredExpenses),
    topExpenseChart: buildTopExpenseChart(filteredExpenses),
  };
}
