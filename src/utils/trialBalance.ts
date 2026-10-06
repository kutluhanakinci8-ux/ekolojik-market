import type {
  BankTransaction,
  CapitalContribution,
  CustomerLedgerEntry,
  EquityPartner,
  SupplierLedgerEntry,
} from '../types/accounting';
import { paymentSourceAccount } from '../data/chartOfAccounts';
import type { ChartAccount } from '../data/chartOfAccounts';
import { getAccount } from '../data/chartOfAccounts';
import {
  getCustomerBalance,
  getCustomerLedgerTotals,
  getSupplierBalance,
  getSupplierLedgerTotals,
} from './accountingAnalytics';
import type { ReportPeriod } from './analytics';
import type { JournalLine, JournalVoucher } from '../types/journalVoucher';
import type { Product, Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import { mergeOperationalSalesIntoTrialBalance } from './trialBalanceOperational';
import { matchesReportPeriod } from './trialBalancePeriod';

export type TrialBalanceRowKind = 'account' | 'group' | 'sub';

export interface TrialBalanceRow {
  rowKey: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balanceDebit: number;
  balanceCredit: number;
  rowKind: TrialBalanceRowKind;
}

export interface TrialBalanceReport {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  voucherCount: number;
  operationalSalesCount: number;
  operationalReturnsCount: number;
}

export interface TrialBalanceNamedEntity {
  id: string;
  name: string;
}

export interface TrialBalanceBankEntity extends TrialBalanceNamedEntity {
  bankName?: string;
  openingBalance?: number;
}

export interface TrialBalanceOptions {
  includeSubAccounts?: boolean;
  chartAccounts?: ChartAccount[];
  bankAccounts?: TrialBalanceBankEntity[];
  customers?: TrialBalanceNamedEntity[];
  suppliers?: TrialBalanceNamedEntity[];
  customerLedger?: CustomerLedgerEntry[];
  supplierLedger?: SupplierLedgerEntry[];
  bankTransactions?: BankTransaction[];
  capitalContributions?: CapitalContribution[];
  equityPartners?: EquityPartner[];
  sales?: Sale[];
  saleReturns?: SaleReturn[];
  products?: Product[];
  /** Kasa / POS satışlarını mizana yansıt (600, 391, 621, ödeme hesapları) */
  includeOperationalSales?: boolean;
}

const ENTITY_LEDGER_ACCOUNTS = new Set(['102', '120', '320']);

interface AccountAgg {
  accountName: string;
  debit: number;
  credit: number;
  glParent?: string;
  closingBalance?: number;
}

function periodRangeEnd(period: ReportPeriod): Date {
  const end = new Date();
  if (period === 'today') end.setHours(23, 59, 59, 999);
  return end;
}

function filterByReportPeriod<T extends { createdAt: string }>(
  items: T[],
  period: ReportPeriod,
): T[] {
  if (period === 'all') return items;

  const now = new Date();
  const start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === 'week') start.setDate(now.getDate() - 7);
  else if (period === 'month') start.setMonth(now.getMonth() - 1);

  const end = periodRangeEnd(period);
  return items.filter((item) => {
    const createdAt = new Date(item.createdAt);
    return createdAt >= start && createdAt <= end;
  });
}

function filterThroughPeriodEnd<T extends { createdAt: string }>(
  items: T[],
  period: ReportPeriod,
): T[] {
  const end = periodRangeEnd(period);
  return items.filter((item) => new Date(item.createdAt) <= end);
}

function filterVouchersByReportPeriod(
  vouchers: JournalVoucher[],
  period: ReportPeriod,
): JournalVoucher[] {
  if (period === 'all') return vouchers;
  return vouchers.filter((voucher) => matchesReportPeriod(voucher.date, voucher.createdAt, period));
}

function filterCapitalContributionsByPeriod(
  contributions: CapitalContribution[],
  period: ReportPeriod,
): CapitalContribution[] {
  if (period === 'all') return contributions;
  return contributions.filter((item) => (
    matchesReportPeriod(item.contributionDate, item.createdAt, period)
  ));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isEntitySubKey(code: string): boolean {
  return /^(102|120|320)\./.test(code);
}

function glParentFromStorageKey(storageKey: string): string | undefined {
  if (isEntitySubKey(storageKey)) return storageKey.split('.')[0];
  return undefined;
}

function balanceColumns(agg: AccountAgg, storageKey: string): { balanceDebit: number; balanceCredit: number } {
  const glParent = agg.glParent ?? glParentFromStorageKey(storageKey);
  const net = agg.closingBalance != null && glParent
    ? roundMoney(agg.closingBalance)
    : roundMoney(agg.debit - agg.credit);

  if (glParent === '320') {
    if (net > 0) return { balanceDebit: 0, balanceCredit: net };
    if (net < 0) return { balanceDebit: Math.abs(net), balanceCredit: 0 };
    return { balanceDebit: 0, balanceCredit: 0 };
  }

  if (net > 0) return { balanceDebit: net, balanceCredit: 0 };
  if (net < 0) return { balanceDebit: 0, balanceCredit: Math.abs(net) };
  return { balanceDebit: 0, balanceCredit: 0 };
}

function aggToRow(
  accountCode: string,
  accountName: string,
  agg: AccountAgg,
  rowKind: TrialBalanceRowKind,
  rowKey: string,
): TrialBalanceRow {
  const debit = roundMoney(agg.debit);
  const credit = roundMoney(agg.credit);
  const balances = balanceColumns(agg, rowKey);
  return {
    rowKey,
    accountCode,
    accountName,
    debit,
    credit,
    balanceDebit: balances.balanceDebit,
    balanceCredit: balances.balanceCredit,
    rowKind,
  };
}

function resolveRollupAccountCode(accountCode: string, chartMap: Map<string, ChartAccount>): string {
  const fromChart = chartMap.get(accountCode)?.parentCode;
  if (fromChart) return fromChart;

  const fromStatic = getAccount(accountCode)?.parentCode;
  if (fromStatic) return fromStatic;

  const dotIndex = accountCode.indexOf('.');
  if (dotIndex > 0) {
    const main = accountCode.slice(0, dotIndex);
    if (chartMap.has(main) || getAccount(main)) return main;
    return main;
  }

  return accountCode;
}

function accountDisplayName(accountCode: string, chartMap: Map<string, ChartAccount>, fallback?: string): string {
  return chartMap.get(accountCode)?.name
    ?? getAccount(accountCode)?.name
    ?? fallback
    ?? accountCode;
}

function usesSubsidiaryLedgers(options: TrialBalanceOptions): boolean {
  return Boolean(
    options.includeSubAccounts
    && (options.customerLedger || options.supplierLedger || options.bankTransactions),
  );
}

function shouldSkipVoucherLineForSubsidiary(
  voucher: JournalVoucher,
  line: JournalLine,
  options: TrialBalanceOptions,
): boolean {
  if (!usesSubsidiaryLedgers(options)) return false;
  switch (line.accountCode) {
    case '120':
      return Boolean(voucher.customerId);
    case '320':
      return Boolean(voucher.supplierId);
    case '102':
      return Boolean(voucher.bankAccountId);
    default:
      return false;
  }
}

function resolveLineAggregateKey(
  voucher: JournalVoucher,
  line: JournalLine,
  includeSubAccounts: boolean,
): string {
  if (!includeSubAccounts || !ENTITY_LEDGER_ACCOUNTS.has(line.accountCode)) {
    return line.accountCode;
  }
  switch (line.accountCode) {
    case '102':
      return `102.${voucher.bankAccountId || 'genel'}`;
    case '120':
      return `120.${voucher.customerId || 'genel'}`;
    case '320':
      return `320.${voucher.supplierId || 'genel'}`;
    default:
      return line.accountCode;
  }
}

function resolveLineAggregateName(
  voucher: JournalVoucher,
  line: JournalLine,
  aggregateKey: string,
  options: TrialBalanceOptions,
): string {
  if (!isEntitySubKey(aggregateKey)) {
    return line.accountName;
  }
  const entityId = aggregateKey.split('.')[1] ?? 'genel';

  if (aggregateKey.startsWith('102.')) {
    if (entityId === 'genel') {
      const desc = line.description?.trim();
      if (desc && desc !== line.accountName) return desc;
      return 'Banka (hesap seçilmemiş)';
    }
    const bank = options.bankAccounts?.find((item) => item.id === entityId);
    const label = voucher.bankAccountName || bank?.name || bank?.bankName;
    return label ? (bank?.bankName && bank.name ? `${bank.name} · ${bank.bankName}` : label) : 'Banka hesabı';
  }

  if (aggregateKey.startsWith('120.')) {
    if (entityId === 'genel') {
      return voucher.customerName || line.description || 'Müşteri (seçilmemiş)';
    }
    const customer = options.customers?.find((item) => item.id === entityId);
    return voucher.customerName || customer?.name || line.description || 'Müşteri';
  }

  if (aggregateKey.startsWith('320.')) {
    if (entityId === 'genel') {
      return voucher.supplierName || line.description || 'Tedarikçi (seçilmemiş)';
    }
    const supplier = options.suppliers?.find((item) => item.id === entityId);
    return voucher.supplierName || supplier?.name || line.description || 'Tedarikçi';
  }

  return line.accountName;
}

function aggregateVoucherLines(
  vouchers: JournalVoucher[],
  options: TrialBalanceOptions,
): Map<string, AccountAgg> {
  const totalsByCode = new Map<string, AccountAgg>();
  const includeSubAccounts = Boolean(options.includeSubAccounts);

  for (const voucher of vouchers) {
    for (const line of voucher.lines) {
      if (line.debit <= 0 && line.credit <= 0) continue;
      if (shouldSkipVoucherLineForSubsidiary(voucher, line, options)) continue;
      const aggregateKey = resolveLineAggregateKey(voucher, line, includeSubAccounts);
      const existing = totalsByCode.get(aggregateKey) ?? {
        accountName: resolveLineAggregateName(voucher, line, aggregateKey, options),
        debit: 0,
        credit: 0,
      };
      existing.debit += line.debit;
      existing.credit += line.credit;
      const nextName = resolveLineAggregateName(voucher, line, aggregateKey, options);
      if (nextName.trim()) {
        existing.accountName = nextName;
      }
      totalsByCode.set(aggregateKey, existing);
    }
  }

  return totalsByCode;
}

function addToDetailMap(
  detailMap: Map<string, AccountAgg>,
  storageKey: string,
  accountName: string,
  debit: number,
  credit: number,
): void {
  if (debit <= 0 && credit <= 0) return;
  const existing = detailMap.get(storageKey) ?? {
    accountName,
    debit: 0,
    credit: 0,
  };
  existing.debit += debit;
  existing.credit += credit;
  if (accountName.trim()) {
    existing.accountName = accountName;
  }
  detailMap.set(storageKey, existing);
}

function mergeCapitalContributionsMissingFromVouchers(
  detailMap: Map<string, AccountAgg>,
  options: TrialBalanceOptions,
  period: ReportPeriod,
  activeVouchers: JournalVoucher[],
  allVouchers: JournalVoucher[],
): void {
  const contributions = options.capitalContributions ?? [];
  const partners = options.equityPartners ?? [];
  if (contributions.length === 0 || partners.length === 0) return;

  const activeIds = new Set(activeVouchers.map((v) => v.id));
  const vouchersById = new Map(allVouchers.map((v) => [v.id, v]));
  const chartMap = new Map((options.chartAccounts ?? []).map((acc) => [acc.code, acc]));

  for (const contribution of filterCapitalContributionsByPeriod(contributions, period)) {
    if (contribution.amountTry <= 0) continue;
    const linked = contribution.journalVoucherId
      ? vouchersById.get(contribution.journalVoucherId)
      : undefined;
    if (linked?.status === 'voided') continue;
    if (linked && activeIds.has(linked.id)) continue;

    const partner = partners.find((item) => item.id === contribution.partnerId);
    const partnerCode = partner?.accountCode ?? '500';
    const partnerName = chartMap.get(partnerCode)?.name
      ?? getAccount(partnerCode)?.name
      ?? (partner ? `${partner.name} sermaye` : partnerCode);
    const payAcc = paymentSourceAccount(contribution.paymentSource === 'cash' ? 'cash' : 'bank');
    const payName = accountDisplayName(payAcc, chartMap);

    addToDetailMap(detailMap, payAcc, payName, contribution.amountTry, 0);
    addToDetailMap(detailMap, partnerCode, partnerName, 0, contribution.amountTry);
  }
}

function bankClosingBalance(
  bank: TrialBalanceBankEntity,
  transactions: BankTransaction[],
  period: ReportPeriod,
): number {
  const movement = filterThroughPeriodEnd(
    transactions.filter((tx) => tx.bankAccountId === bank.id),
    period,
  ).reduce((sum, tx) => sum + tx.amount, 0);
  return roundMoney((bank.openingBalance ?? 0) + movement);
}

function applySubsidiaryLedgerBreakdown(
  detailMap: Map<string, AccountAgg>,
  options: TrialBalanceOptions,
  period: ReportPeriod,
): void {
  if (!usesSubsidiaryLedgers(options)) return;

  for (const key of [...detailMap.keys()]) {
    if (isEntitySubKey(key) && !key.endsWith('.genel')) {
      detailMap.delete(key);
    }
  }

  const customerLedger = options.customerLedger ?? [];
  const supplierLedger = options.supplierLedger ?? [];
  const bankTransactions = options.bankTransactions ?? [];

  for (const bank of options.bankAccounts ?? []) {
    const periodTx = filterByReportPeriod(
      bankTransactions.filter((tx) => tx.bankAccountId === bank.id),
      period,
    );
    let debit = 0;
    let credit = 0;
    for (const tx of periodTx) {
      if (tx.amount > 0) debit += tx.amount;
      else credit += Math.abs(tx.amount);
    }
    const label = bank.bankName ? `${bank.name} · ${bank.bankName}` : bank.name;
    const closingBalance = bankClosingBalance(bank, bankTransactions, period);
    if (debit === 0 && credit === 0 && closingBalance === 0) continue;
    detailMap.set(`102.${bank.id}`, {
      accountName: label,
      debit: roundMoney(debit),
      credit: roundMoney(credit),
      glParent: '102',
      closingBalance,
    });
  }

  const customerIds = new Set([
    ...(options.customers ?? []).map((item) => item.id),
    ...customerLedger.map((entry) => entry.customerId),
  ]);

  for (const customerId of customerIds) {
    const periodEntries = filterByReportPeriod(
      customerLedger.filter((entry) => entry.customerId === customerId),
      period,
    );
    const closingEntries = filterThroughPeriodEnd(
      customerLedger.filter((entry) => entry.customerId === customerId),
      period,
    );
    const movement = getCustomerLedgerTotals(periodEntries);
    const closingBalance = getCustomerBalance(closingEntries);
    if (movement.debit === 0 && movement.credit === 0 && closingBalance === 0) continue;
    const customer = options.customers?.find((item) => item.id === customerId);
    detailMap.set(`120.${customerId}`, {
      accountName: customer?.name ?? 'Müşteri',
      debit: movement.debit,
      credit: movement.credit,
      glParent: '120',
      closingBalance,
    });
  }

  const supplierIds = new Set([
    ...(options.suppliers ?? []).map((item) => item.id),
    ...supplierLedger.map((entry) => entry.supplierId),
  ]);

  for (const supplierId of supplierIds) {
    const periodEntries = filterByReportPeriod(
      supplierLedger.filter((entry) => entry.supplierId === supplierId),
      period,
    );
    const closingEntries = filterThroughPeriodEnd(
      supplierLedger.filter((entry) => entry.supplierId === supplierId),
      period,
    );
    const movement = getSupplierLedgerTotals(periodEntries);
    const closingBalance = getSupplierBalance(closingEntries);
    if (movement.debit === 0 && movement.credit === 0 && closingBalance === 0) continue;
    const supplier = options.suppliers?.find((item) => item.id === supplierId);
    detailMap.set(`320.${supplierId}`, {
      accountName: supplier?.name ?? 'Tedarikçi',
      debit: movement.credit,
      credit: movement.debit,
      glParent: '320',
      closingBalance,
    });
  }
}

function displayAccountCodeForRow(storageKey: string, rowKind: TrialBalanceRowKind): string {
  if (rowKind === 'sub' && isEntitySubKey(storageKey)) return '—';
  if (rowKind === 'group' && isEntitySubKey(storageKey)) {
    return storageKey.split('.')[0] ?? storageKey;
  }
  return storageKey;
}

function displayNameForRow(
  storageKey: string,
  agg: AccountAgg,
  chartMap: Map<string, ChartAccount>,
  rowKind: TrialBalanceRowKind,
): string {
  if (rowKind === 'sub' && isEntitySubKey(storageKey)) {
    return agg.accountName;
  }
  return accountDisplayName(storageKey, chartMap, agg.accountName);
}

function mergeAgg(target: AccountAgg, source: AccountAgg): void {
  target.debit += source.debit;
  target.credit += source.credit;
  if (source.accountName.trim()) {
    target.accountName = source.accountName;
  }
  if (source.closingBalance != null) {
    target.closingBalance = roundMoney((target.closingBalance ?? 0) + source.closingBalance);
  }
  if (source.glParent && !target.glParent) {
    target.glParent = source.glParent;
  }
}

function buildSummaryRows(
  detailMap: Map<string, AccountAgg>,
  chartMap: Map<string, ChartAccount>,
): TrialBalanceRow[] {
  const rollup = new Map<string, AccountAgg>();

  for (const [code, agg] of detailMap.entries()) {
    const parentCode = resolveRollupAccountCode(code, chartMap);
    const existing = rollup.get(parentCode) ?? {
      accountName: accountDisplayName(parentCode, chartMap),
      debit: 0,
      credit: 0,
    };
    mergeAgg(existing, agg);
    rollup.set(parentCode, existing);
  }

  return [...rollup.entries()]
    .map(([code, agg]) => aggToRow(
      code,
      accountDisplayName(code, chartMap, agg.accountName),
      agg,
      'account',
      code,
    ))
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode, 'tr'));
}

function buildDetailedRows(
  detailMap: Map<string, AccountAgg>,
  chartMap: Map<string, ChartAccount>,
): TrialBalanceRow[] {
  const detailRows = [...detailMap.entries()].map(([code, agg]) => ({
    code,
    agg,
    parent: resolveRollupAccountCode(code, chartMap),
  }));

  const childrenByParent = new Map<string, typeof detailRows>();
  for (const item of detailRows) {
    if (item.parent === item.code) continue;
    const list = childrenByParent.get(item.parent) ?? [];
    list.push(item);
    childrenByParent.set(item.parent, list);
  }

  const parentsWithChildren = new Set(childrenByParent.keys());
  const emitted = new Set<string>();
  const output: TrialBalanceRow[] = [];

  const standalone = detailRows
    .filter((item) => !parentsWithChildren.has(item.code) && item.parent === item.code)
    .sort((a, b) => a.code.localeCompare(b.code, 'tr'));

  for (const item of standalone) {
    output.push(aggToRow(
      displayAccountCodeForRow(item.code, 'account'),
      displayNameForRow(item.code, item.agg, chartMap, 'account'),
      item.agg,
      'account',
      item.code,
    ));
    emitted.add(item.code);
  }

  const sortedParents = [...parentsWithChildren].sort((a, b) => a.localeCompare(b, 'tr'));

  for (const parentCode of sortedParents) {
    const children = (childrenByParent.get(parentCode) ?? []).sort((a, b) => (
      a.agg.accountName.localeCompare(b.agg.accountName, 'tr')
    ));
    const direct = detailRows.find((item) => item.code === parentCode);

    const groupAgg: AccountAgg = {
      accountName: accountDisplayName(parentCode, chartMap),
      debit: 0,
      credit: 0,
      glParent: ['102', '120', '320'].includes(parentCode) ? parentCode : undefined,
    };
    if (direct) mergeAgg(groupAgg, direct.agg);
    for (const child of children) mergeAgg(groupAgg, child.agg);

    output.push(aggToRow(
      displayAccountCodeForRow(parentCode, 'group'),
      accountDisplayName(parentCode, chartMap, groupAgg.accountName),
      groupAgg,
      'group',
      `group-${parentCode}`,
    ));

    if (direct && !emitted.has(direct.code)) {
      output.push(aggToRow(
        displayAccountCodeForRow(direct.code, 'sub'),
        displayNameForRow(direct.code, direct.agg, chartMap, 'sub'),
        direct.agg,
        'sub',
        direct.code,
      ));
      emitted.add(direct.code);
    }

    for (const child of children) {
      output.push(aggToRow(
        displayAccountCodeForRow(child.code, 'sub'),
        displayNameForRow(child.code, child.agg, chartMap, 'sub'),
        child.agg,
        'sub',
        child.code,
      ));
      emitted.add(child.code);
    }
  }

  for (const item of detailRows) {
    if (emitted.has(item.code)) continue;
    output.push(aggToRow(
      displayAccountCodeForRow(item.code, 'account'),
      displayNameForRow(item.code, item.agg, chartMap, 'account'),
      item.agg,
      'account',
      item.code,
    ));
  }

  return output;
}

export function buildTrialBalance(
  vouchers: JournalVoucher[],
  period: ReportPeriod,
  options: TrialBalanceOptions = {},
): TrialBalanceReport {
  const chartMap = new Map((options.chartAccounts ?? []).map((acc) => [acc.code, acc]));
  const nonVoided = vouchers.filter((v) => v.status !== 'voided');
  const active = filterVouchersByReportPeriod(nonVoided, period);

  const detailMap = aggregateVoucherLines(active, options);
  mergeCapitalContributionsMissingFromVouchers(detailMap, options, period, active, nonVoided);

  let operationalSalesCount = 0;
  let operationalReturnsCount = 0;
  if (options.includeOperationalSales !== false && options.sales && options.products) {
    const stats = mergeOperationalSalesIntoTrialBalance(
      detailMap,
      period,
      options.sales,
      options.saleReturns ?? [],
      options.products,
      {
        includeSubAccounts: options.includeSubAccounts,
        hasCustomerLedger: Boolean(options.customerLedger?.length),
        hasSupplierLedger: Boolean(options.supplierLedger?.length),
        hasBankTransactions: Boolean(options.bankTransactions?.length),
      },
    );
    operationalSalesCount = stats.salesCount;
    operationalReturnsCount = stats.returnsCount;
  }

  applySubsidiaryLedgerBreakdown(detailMap, options, period);

  let totalDebit = 0;
  let totalCredit = 0;
  for (const agg of detailMap.values()) {
    totalDebit += agg.debit;
    totalCredit += agg.credit;
  }
  totalDebit = roundMoney(totalDebit);
  totalCredit = roundMoney(totalCredit);

  const rows = options.includeSubAccounts
    ? buildDetailedRows(detailMap, chartMap)
    : buildSummaryRows(detailMap, chartMap);

  return {
    rows,
    totalDebit,
    totalCredit,
    voucherCount: active.length,
    operationalSalesCount,
    operationalReturnsCount,
  };
}

export function trialBalancePeriodLabel(period: ReportPeriod): string {
  switch (period) {
    case 'today':
      return 'Bugün';
    case 'week':
      return 'Son 7 gün';
    case 'month':
      return 'Son 30 gün';
    default:
      return 'Tüm fişler';
  }
}
