import type { CashHandover, DailyCashSession, Expense } from '../types/business';
import type { JournalVoucher } from '../types/journalVoucher';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { sumCashVirmanForDate } from './cashRegisterTransfers';
import {
  getBusinessDateKey,
  getBusinessDateKeyFromIso,
  getNextBusinessDateKey,
  getPreviousBusinessDateKey,
} from './businessDate';
import { getPaymentBreakdown } from './analytics';

export interface BusinessDatedRecord {
  createdAt: string;
  businessDate?: string;
}

export function getRecordBusinessDateKey(record: BusinessDatedRecord): string {
  return record.businessDate ?? getBusinessDateKeyFromIso(record.createdAt);
}

export function filterByBusinessDate<T extends BusinessDatedRecord>(items: T[], dateKey: string): T[] {
  return items.filter((item) => getRecordBusinessDateKey(item) === dateKey);
}

export function computeDayCashDrawer(
  openingBalance: number,
  sales: Sale[],
  returns: SaleReturn[],
  expenses: Expense[],
  handovers: CashHandover[],
  cashToBank = 0,
  bankToCash = 0,
): number {
  const payment = getPaymentBreakdown(sales, returns);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const handoverTotal = handovers.reduce((sum, handover) => sum + handover.amount, 0);
  return openingBalance + payment.cash - expenseTotal - handoverTotal - cashToBank + bankToCash;
}

export function reconcileCashSessions(
  sessions: DailyCashSession[],
  sales: Sale[],
  returns: SaleReturn[],
  expenses: Expense[],
  handovers: CashHandover[],
  journalVouchers: JournalVoucher[] = [],
): DailyCashSession[] {
  const today = getBusinessDateKey();
  const byDate = new Map(sessions.map((session) => [session.date, { ...session }]));

  for (const [date, session] of [...byDate.entries()]) {
    if (date >= today || session.closingBalance != null) continue;

    const virman = sumCashVirmanForDate(journalVouchers, date);
    const closingBalance = computeDayCashDrawer(
      session.openingBalance,
      filterByBusinessDate(sales, date),
      filterByBusinessDate(returns, date),
      filterByBusinessDate(expenses, date),
      filterByBusinessDate(handovers, date),
      virman.cashToBank,
      virman.bankToCash,
    );

    byDate.set(date, {
      ...session,
      closingBalance,
      closedAt: session.closedAt ?? new Date().toISOString(),
      autoClosed: true,
    });
  }

  if (!byDate.has(today)) {
    const previousDate = getPreviousBusinessDateKey(today);
    const previousSession = byDate.get(previousDate);
    byDate.set(today, {
      date: today,
      openingBalance: resolveCarriedOpeningBalance(previousSession),
      createdAt: new Date().toISOString(),
    });
  }

  for (const session of [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))) {
    if (!session.closedAt || session.closingBalance == null) continue;
    ensureNextSessionOpening(byDate, session.date, session.closingBalance);
  }

  let cursor = today;
  while (true) {
    const session = byDate.get(cursor);
    if (!session?.closedAt) break;
    ensureNextSessionOpening(byDate, cursor, session.closingBalance ?? 0);
    cursor = getNextBusinessDateKey(cursor);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function resolveCarriedOpeningBalance(previousSession?: DailyCashSession): number {
  if (!previousSession?.closedAt) return 0;
  return previousSession.closingBalance ?? 0;
}

function ensureNextSessionOpening(
  byDate: Map<string, DailyCashSession>,
  closedDate: string,
  closingBalance: number,
): void {
  const nextDate = getNextBusinessDateKey(closedDate);
  const existing = byDate.get(nextDate);
  if (!existing) {
    byDate.set(nextDate, {
      date: nextDate,
      openingBalance: closingBalance,
      createdAt: new Date().toISOString(),
    });
    return;
  }

  if (!existing.closedAt && existing.openingBalance !== closingBalance) {
    byDate.set(nextDate, {
      ...existing,
      openingBalance: closingBalance,
    });
  }
}

export function getOperationalBusinessDateKey(sessions: DailyCashSession[]): string {
  const calendarToday = getBusinessDateKey();
  let cursor = calendarToday;

  while (true) {
    const session = sessions.find((entry) => entry.date === cursor);
    if (session?.closedAt) {
      cursor = getNextBusinessDateKey(cursor);
      continue;
    }
    return cursor;
  }
}

export function getTodayCashSession(sessions: DailyCashSession[]): DailyCashSession | null {
  const today = getBusinessDateKey();
  return sessions.find((session) => session.date === today) ?? null;
}

export function getCashSessionForDate(
  sessions: DailyCashSession[],
  dateKey: string,
): DailyCashSession | null {
  return sessions.find((session) => session.date === dateKey) ?? null;
}

export function getClosedCashSessions(sessions: DailyCashSession[]): DailyCashSession[] {
  return sessions
    .filter((session) => Boolean(session.closedAt))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function formatBusinessDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export function formatBusinessDateShort(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}
