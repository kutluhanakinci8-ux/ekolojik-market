import type { CashHandover, Expense } from '../types/business';
import type { CustomExpenseCategory } from '../types/business';
import { getExpenseCategoryLabel } from './expenseCategories';
import type { JournalVoucher } from '../types/journalVoucher';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { getPaymentBreakdown } from './analytics';
import { computeDayCashDrawer } from './cashSession';
import { listCashVirmanVouchersForDate, type CashVirmanTotals } from './cashRegisterTransfers';

export interface CashRegisterSummary {
  grossSales: number;
  refundTotal: number;
  netRevenue: number;
  expenseTotal: number;
  handoverTotal: number;
  openingBalance: number;
  netPosition: number;
  saleCount: number;
  returnCount: number;
  expenseCount: number;
  handoverCount: number;
  cashToBankTotal: number;
  bankToCashTotal: number;
  virmanCount: number;
  avgTicket: number;
  payment: { cash: number; card: number; transfer: number };
  /** Açılış + nakit tahsilat − nakit iade − gider − yönetime devir */
  cashDrawerEstimate: number;
  /** Gün sonu kasada kalması beklenen tutar (ertesi güne devir) */
  closingBalance: number;
}

export type CashActivityKind =
  | 'sale'
  | 'return'
  | 'expense'
  | 'handover'
  | 'opening'
  | 'cash_to_bank'
  | 'bank_to_cash';

export interface CashActivityItem {
  id: string;
  kind: CashActivityKind;
  amount: number;
  signedAmount: number;
  /** Nakit kasa bakiyesine etkisi */
  cashImpact: number;
  label: string;
  sublabel: string;
  paymentLabel: string;
  createdAt: string;
  /** Manuel girilen gider kaydı — silinebilir */
  isManual?: boolean;
  expenseId?: string;
  handoverId?: string;
}

export type CashActivityRow = CashActivityItem & { runningBalance: number };

export const CASH_ACTIVITY_KIND_LABELS: Record<CashActivityKind, string> = {
  sale: 'Satış',
  return: 'İade',
  expense: 'Gider',
  handover: 'Devir',
  opening: 'Açılış',
  cash_to_bank: 'Bankaya',
  bank_to_cash: 'Bankadan',
};

function buildOpeningCarryItem(
  businessDateKey: string,
  openingBalance: number,
  createdAt: string,
): CashActivityItem {
  return {
    id: `opening-${businessDateKey}`,
    kind: 'opening',
    amount: Math.abs(openingBalance),
    signedAmount: openingBalance,
    cashImpact: openingBalance,
    label: 'Önceki günden devir',
    sublabel: 'Açılış bakiyesi',
    paymentLabel: 'Otomatik devir',
    createdAt,
    isManual: false,
  };
}

function resolveOpeningCreatedAt(businessDateKey: string, items: CashActivityItem[]): string {
  const transactionTimes = items
    .filter((item) => item.kind !== 'opening')
    .map((item) => new Date(item.createdAt).getTime());

  if (transactionTimes.length > 0) {
    return new Date(Math.min(...transactionTimes) - 1000).toISOString();
  }

  const [y, m, d] = businessDateKey.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 1).toISOString();
}

function sortActivityForDisplay(a: CashActivityItem, b: CashActivityItem): number {
  if (a.kind === 'opening' && b.kind !== 'opening') return 1;
  if (b.kind === 'opening' && a.kind !== 'opening') return -1;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function sortActivityForBalance(a: CashActivityItem, b: CashActivityItem): number {
  if (a.kind === 'opening' && b.kind !== 'opening') return -1;
  if (b.kind === 'opening' && a.kind !== 'opening') return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

const PAYMENT_LABELS = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  credit: 'Veresiye',
  split: 'Bölünmüş',
} as const;

function saleCashImpact(sale: Sale): number {
  if (sale.paymentMethod === 'cash') return sale.total;
  if (sale.paymentMethod === 'split') {
    return sale.paymentSplits?.find((split) => split.method === 'cash')?.amount ?? 0;
  }
  return 0;
}

export function buildCashRegisterSummary(
  sales: Sale[],
  returns: SaleReturn[],
  expenses: Expense[],
  handovers: CashHandover[],
  openingBalance: number,
  virman: Pick<CashVirmanTotals, 'cashToBank' | 'bankToCash' | 'count'> = {
    cashToBank: 0,
    bankToCash: 0,
    count: 0,
  },
): CashRegisterSummary {
  const grossSales = sales.reduce((sum, sale) => sum + sale.total, 0);
  const refundTotal = returns.reduce((sum, entry) => sum + entry.refundTotal, 0);
  const expenseTotal = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const handoverTotal = handovers.reduce((sum, handover) => sum + handover.amount, 0);
  const netRevenue = grossSales - refundTotal;
  const payment = getPaymentBreakdown(sales, returns);
  const cashDrawerEstimate = computeDayCashDrawer(
    openingBalance,
    sales,
    returns,
    expenses,
    handovers,
    virman.cashToBank,
    virman.bankToCash,
  );

  return {
    grossSales,
    refundTotal,
    netRevenue,
    expenseTotal,
    handoverTotal,
    openingBalance,
    netPosition: netRevenue - expenseTotal,
    saleCount: sales.length,
    returnCount: returns.length,
    expenseCount: expenses.length,
    handoverCount: handovers.length,
    cashToBankTotal: virman.cashToBank,
    bankToCashTotal: virman.bankToCash,
    virmanCount: virman.count,
    avgTicket: sales.length > 0 ? grossSales / sales.length : 0,
    payment,
    cashDrawerEstimate,
    closingBalance: cashDrawerEstimate,
  };
}

export function buildCashActivityFeed(
  sales: Sale[],
  returns: SaleReturn[],
  expenses: Expense[],
  handovers: CashHandover[],
  openingBalance: number,
  businessDateKey: string,
  limit = 30,
  customExpenseCategories: CustomExpenseCategory[] = [],
  journalVouchers: JournalVoucher[] = [],
): CashActivityItem[] {
  const items: CashActivityItem[] = [];

  for (const sale of sales) {
    items.push({
      id: sale.id,
      kind: 'sale',
      amount: sale.total,
      signedAmount: sale.total,
      cashImpact: saleCashImpact(sale),
      label: `Satış ${sale.id}`,
      sublabel: sale.cashierName ?? sale.customerName ?? 'Perakende',
      paymentLabel: PAYMENT_LABELS[sale.paymentMethod] ?? sale.paymentMethod,
      createdAt: sale.createdAt,
    });
  }

  for (const entry of returns) {
    items.push({
      id: entry.id,
      kind: 'return',
      amount: entry.refundTotal,
      signedAmount: -entry.refundTotal,
      cashImpact: entry.refundMethod === 'cash' ? -entry.refundTotal : 0,
      label: `İade ${entry.id}`,
      sublabel: `Fiş ${entry.originalSaleId}${entry.reason ? ` · ${entry.reason}` : ''}`,
      paymentLabel: PAYMENT_LABELS[entry.refundMethod],
      createdAt: entry.createdAt,
    });
  }

  for (const expense of expenses) {
    items.push({
      id: expense.id,
      kind: 'expense',
      amount: expense.amount,
      signedAmount: -expense.amount,
      cashImpact: -expense.amount,
      label: expense.description,
      sublabel: getExpenseCategoryLabel(expense.category, customExpenseCategories),
      paymentLabel: 'Nakit çıkış',
      createdAt: expense.createdAt,
      isManual: true,
      expenseId: expense.id,
    });
  }

  for (const voucher of listCashVirmanVouchersForDate(journalVouchers, businessDateKey)) {
    const isOut = voucher.bankMovementKind === 'cash_to_bank';
    items.push({
      id: voucher.id,
      kind: isOut ? 'cash_to_bank' : 'bank_to_cash',
      amount: voucher.amount,
      signedAmount: isOut ? -voucher.amount : voucher.amount,
      cashImpact: isOut ? -voucher.amount : voucher.amount,
      label: voucher.description.trim() || (isOut ? 'Kasa → banka virman' : 'Banka → kasa virman'),
      sublabel: voucher.voucherNo,
      paymentLabel: isOut ? 'Virman çıkış' : 'Virman giriş',
      createdAt: voucher.createdAt,
      isManual: false,
    });
  }

  for (const handover of handovers) {
    items.push({
      id: handover.id,
      kind: 'handover',
      amount: handover.amount,
      signedAmount: -handover.amount,
      cashImpact: -handover.amount,
      label: `Yönetime devir · ${handover.recipient}`,
      sublabel: handover.note || handover.createdBy || 'Kasiyer',
      paymentLabel: 'Nakit çıkış',
      createdAt: handover.createdAt,
      isManual: true,
      handoverId: handover.id,
    });
  }

  const openingCreatedAt = resolveOpeningCreatedAt(businessDateKey, items);
  items.unshift(buildOpeningCarryItem(businessDateKey, openingBalance, openingCreatedAt));

  const sorted = [...items].sort(sortActivityForDisplay);
  if (limit <= 0) return sorted;

  const opening = sorted.find((item) => item.kind === 'opening');
  const others = sorted.filter((item) => item.kind !== 'opening');
  const limitedOthers = others.slice(0, opening ? Math.max(0, limit - 1) : limit);
  return opening ? [...limitedOthers, opening] : limitedOthers;
}

export function attachRunningBalances(
  items: CashActivityItem[],
): CashActivityRow[] {
  const chronological = [...items].sort(sortActivityForBalance);

  const balanceByKey = new Map<string, number>();
  let balance = 0;

  for (const item of chronological) {
    balance += item.cashImpact;
    balanceByKey.set(`${item.kind}-${item.id}`, balance);
  }

  const fallbackBalance = chronological.length > 0
    ? balanceByKey.get(`${chronological[chronological.length - 1].kind}-${chronological[chronological.length - 1].id}`) ?? 0
    : 0;

  return items.map((item) => ({
    ...item,
    runningBalance: balanceByKey.get(`${item.kind}-${item.id}`) ?? fallbackBalance,
  }));
}

export function formatDeltaPercent(current: number, baseline: number): string | null {
  if (baseline <= 0) return null;
  const pct = Math.round(((current - baseline) / baseline) * 100);
  if (pct === 0) return '≈ ortalama';
  return pct > 0 ? `+${pct}% haftalık ort.` : `${pct}% haftalık ort.`;
}
