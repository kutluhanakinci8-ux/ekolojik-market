import type { CashHandover, DailyCashSession, Expense, ExpenseCategory } from '../types/business';
import type { JournalVoucher } from '../types/journalVoucher';
import { sumCashVirmanForDate } from './cashRegisterTransfers';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { CustomExpenseCategory } from '../types/business';
import { getExpenseCategoryLabel } from './expenseCategories';
import type { ReportPeriod } from './analytics';
import { getBusinessDateKey } from './businessDate';
import {
  filterByBusinessDate,
  formatBusinessDateShort,
  getCashSessionForDate,
  getOperationalBusinessDateKey,
} from './cashSession';
import { buildCashRegisterSummary, type CashActivityKind } from './cashRegister';

export interface CashReportDateRange {
  from: string;
  to: string;
}

export interface DailyCashReportRow {
  date: string;
  dateLabel: string;
  openingBalance: number;
  closingBalance: number;
  grossSales: number;
  refundTotal: number;
  expenseTotal: number;
  handoverTotal: number;
  cashSales: number;
  cashRefunds: number;
  netCashFlow: number;
  saleCount: number;
  returnCount: number;
  expenseCount: number;
  handoverCount: number;
  isClosed: boolean;
  closedBy?: string;
}

export interface CashReportCategoryRow {
  category: ExpenseCategory;
  label: string;
  total: number;
  count: number;
  share: number;
}

export interface CashFlowTrendPoint {
  date: string;
  dateLabel: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface CashActivityBreakdownRow {
  kind: CashActivityKind;
  label: string;
  count: number;
  total: number;
  cashImpact: number;
}

export interface CashReportSummary {
  range: CashReportDateRange;
  dailyRows: DailyCashReportRow[];
  totalExpenses: number;
  totalHandovers: number;
  totalCashSales: number;
  totalCashRefunds: number;
  totalGrossSales: number;
  totalRefunds: number;
  netCashMovement: number;
  averageClosing: number;
  sessionCount: number;
  closedSessionCount: number;
  expenseByCategory: CashReportCategoryRow[];
  cashFlowTrend: CashFlowTrendPoint[];
  activityBreakdown: CashActivityBreakdownRow[];
  expenses: Expense[];
  handovers: CashHandover[];
}

function getRecordDateKey(record: { createdAt: string; businessDate?: string }): string {
  return record.businessDate ?? getBusinessDateKey(new Date(record.createdAt));
}

function filterByDateRange<T extends { createdAt: string; businessDate?: string }>(
  items: T[],
  from: string,
  to: string,
): T[] {
  return items.filter((item) => {
    const dateKey = getRecordDateKey(item);
    return dateKey >= from && dateKey <= to;
  });
}

function collectDatesInRange(
  from: string,
  to: string,
  sessions: DailyCashSession[],
  sales: Sale[],
  returns: SaleReturn[],
  expenses: Expense[],
  handovers: CashHandover[],
): string[] {
  const dates = new Set<string>();

  for (const session of sessions) {
    if (session.date >= from && session.date <= to) dates.add(session.date);
  }
  for (const sale of sales) {
    const dateKey = getRecordDateKey(sale);
    if (dateKey >= from && dateKey <= to) dates.add(dateKey);
  }
  for (const entry of returns) {
    const dateKey = getRecordDateKey(entry);
    if (dateKey >= from && dateKey <= to) dates.add(dateKey);
  }
  for (const expense of expenses) {
    const dateKey = getRecordDateKey(expense);
    if (dateKey >= from && dateKey <= to) dates.add(dateKey);
  }
  for (const handover of handovers) {
    const dateKey = getRecordDateKey(handover);
    if (dateKey >= from && dateKey <= to) dates.add(dateKey);
  }

  return [...dates].sort((a, b) => a.localeCompare(b));
}

export function resolveCashReportDateRange(
  period: ReportPeriod,
  useCustomRange: boolean,
  dateFrom: string,
  dateTo: string,
  sales: Sale[],
  expenses: Expense[],
  handovers: CashHandover[],
  returns: SaleReturn[],
  sessions: DailyCashSession[],
): CashReportDateRange {
  if (useCustomRange && dateFrom && dateTo) {
    return { from: dateFrom, to: dateTo };
  }

  const to = getOperationalBusinessDateKey(sessions);
  const now = new Date();

  if (period === 'today') {
    return { from: to, to };
  }

  if (period === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 7);
    return { from: getBusinessDateKey(start), to };
  }

  if (period === 'month') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { from: getBusinessDateKey(start), to };
  }

  const allDates = [
    ...sales.map(getRecordDateKey),
    ...expenses.map(getRecordDateKey),
    ...handovers.map(getRecordDateKey),
    ...returns.map(getRecordDateKey),
    ...sessions.map((session) => session.date),
  ].sort();

  const from = allDates[0] ?? to;
  return { from, to };
}

export function buildCashReport(
  sales: Sale[],
  returns: SaleReturn[],
  expenses: Expense[],
  handovers: CashHandover[],
  sessions: DailyCashSession[],
  range: CashReportDateRange,
  customExpenseCategories: CustomExpenseCategory[] = [],
  journalVouchers: JournalVoucher[] = [],
): CashReportSummary {
  const rangeSales = filterByDateRange(sales, range.from, range.to);
  const rangeReturns = filterByDateRange(returns, range.from, range.to);
  const rangeExpenses = filterByDateRange(expenses, range.from, range.to);
  const rangeHandovers = filterByDateRange(handovers, range.from, range.to);
  const rangeSessions = sessions.filter((session) => session.date >= range.from && session.date <= range.to);

  const dates = collectDatesInRange(
    range.from,
    range.to,
    sessions,
    sales,
    returns,
    expenses,
    handovers,
  );

  const dailyRows: DailyCashReportRow[] = dates.map((date) => {
    const daySales = filterByBusinessDate(rangeSales, date);
    const dayReturns = filterByBusinessDate(rangeReturns, date);
    const dayExpenses = filterByBusinessDate(rangeExpenses, date);
    const dayHandovers = filterByBusinessDate(rangeHandovers, date);
    const session = getCashSessionForDate(rangeSessions, date) ?? getCashSessionForDate(sessions, date);
    const openingBalance = session?.openingBalance ?? 0;
    const virman = sumCashVirmanForDate(journalVouchers, date);
    const summary = buildCashRegisterSummary(
      daySales,
      dayReturns,
      dayExpenses,
      dayHandovers,
      openingBalance,
      virman,
    );

    const cashSales = daySales
      .filter((sale) => sale.paymentMethod === 'cash')
      .reduce((sum, sale) => sum + sale.total, 0);
    const cashRefunds = dayReturns
      .filter((entry) => entry.refundMethod === 'cash')
      .reduce((sum, entry) => sum + entry.refundTotal, 0);
    const inflow = cashSales;
    const outflow = cashRefunds + summary.expenseTotal + summary.handoverTotal + summary.cashToBankTotal;

    return {
      date,
      dateLabel: formatBusinessDateShort(date),
      openingBalance,
      closingBalance: session?.closingBalance ?? summary.closingBalance,
      grossSales: summary.grossSales,
      refundTotal: summary.refundTotal,
      expenseTotal: summary.expenseTotal,
      handoverTotal: summary.handoverTotal,
      cashSales,
      cashRefunds,
      netCashFlow: inflow - outflow,
      saleCount: summary.saleCount,
      returnCount: summary.returnCount,
      expenseCount: summary.expenseCount,
      handoverCount: summary.handoverCount,
      isClosed: Boolean(session?.closedAt),
      closedBy: session?.closedBy,
    };
  });

  const expenseByCategoryMap = new Map<ExpenseCategory, { total: number; count: number }>();
  for (const expense of rangeExpenses) {
    const current = expenseByCategoryMap.get(expense.category) ?? { total: 0, count: 0 };
    expenseByCategoryMap.set(expense.category, {
      total: current.total + expense.amount,
      count: current.count + 1,
    });
  }

  const totalExpenses = rangeExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const expenseByCategory: CashReportCategoryRow[] = [...expenseByCategoryMap.entries()]
    .map(([category, value]) => ({
      category,
      label: getExpenseCategoryLabel(category, customExpenseCategories),
      total: value.total,
      count: value.count,
      share: totalExpenses > 0 ? Math.round((value.total / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  const totalHandovers = rangeHandovers.reduce((sum, handover) => sum + handover.amount, 0);
  const totalCashSales = rangeSales
    .filter((sale) => sale.paymentMethod === 'cash')
    .reduce((sum, sale) => sum + sale.total, 0);
  const totalCashRefunds = rangeReturns
    .filter((entry) => entry.refundMethod === 'cash')
    .reduce((sum, entry) => sum + entry.refundTotal, 0);
  const totalGrossSales = rangeSales.reduce((sum, sale) => sum + sale.total, 0);
  const totalRefunds = rangeReturns.reduce((sum, entry) => sum + entry.refundTotal, 0);
  const totalCashToBank = journalVouchers
    .filter((v) => v.status !== 'voided' && v.transactionType === 'bank_movement' && v.bankMovementKind === 'cash_to_bank')
    .filter((v) => v.date >= range.from && v.date <= range.to)
    .reduce((sum, v) => sum + v.amount, 0);
  const totalBankToCash = journalVouchers
    .filter((v) => v.status !== 'voided' && v.transactionType === 'bank_movement' && v.bankMovementKind === 'bank_to_cash')
    .filter((v) => v.date >= range.from && v.date <= range.to)
    .reduce((sum, v) => sum + v.amount, 0);
  const netCashMovement = totalCashSales - totalCashRefunds - totalExpenses - totalHandovers - totalCashToBank + totalBankToCash;

  const cashFlowTrend: CashFlowTrendPoint[] = dailyRows.map((row) => ({
    date: row.date,
    dateLabel: row.dateLabel,
    inflow: row.cashSales,
    outflow: row.cashRefunds + row.expenseTotal + row.handoverTotal,
    net: row.netCashFlow,
  }));

  const activityBreakdown: CashActivityBreakdownRow[] = [
    {
      kind: 'sale',
      label: 'Nakit Satış',
      count: rangeSales.filter((sale) => sale.paymentMethod === 'cash').length,
      total: totalCashSales,
      cashImpact: totalCashSales,
    },
    {
      kind: 'return',
      label: 'Nakit İade',
      count: rangeReturns.filter((entry) => entry.refundMethod === 'cash').length,
      total: totalCashRefunds,
      cashImpact: -totalCashRefunds,
    },
    {
      kind: 'expense',
      label: 'Gider',
      count: rangeExpenses.length,
      total: totalExpenses,
      cashImpact: -totalExpenses,
    },
    {
      kind: 'handover',
      label: 'Yönetime Devir',
      count: rangeHandovers.length,
      total: totalHandovers,
      cashImpact: -totalHandovers,
    },
  ];

  const closedSessionCount = dailyRows.filter((row) => row.isClosed).length;
  const averageClosing = dailyRows.length > 0
    ? dailyRows.reduce((sum, row) => sum + row.closingBalance, 0) / dailyRows.length
    : 0;

  return {
    range,
    dailyRows,
    totalExpenses,
    totalHandovers,
    totalCashSales,
    totalCashRefunds,
    totalGrossSales,
    totalRefunds,
    netCashMovement,
    averageClosing,
    sessionCount: dailyRows.length,
    closedSessionCount,
    expenseByCategory,
    cashFlowTrend,
    activityBreakdown,
    expenses: [...rangeExpenses].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    handovers: [...rangeHandovers].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  };
}
