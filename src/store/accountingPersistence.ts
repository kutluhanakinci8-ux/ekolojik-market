import { createDefaultEquityPartners } from '../data/defaultEquityPartners';
import type { AccountingSnapshot } from '../types/accounting';
import { EMPTY_ACCOUNTING_SNAPSHOT } from '../types/accounting';

const STORAGE_PREFIX = 'market-pos-accounting-';

const KEYS = {
  suppliers: `${STORAGE_PREFIX}suppliers`,
  customerLedger: `${STORAGE_PREFIX}customer-ledger`,
  supplierLedger: `${STORAGE_PREFIX}supplier-ledger`,
  bankAccounts: `${STORAGE_PREFIX}bank-accounts`,
  bankTransactions: `${STORAGE_PREFIX}bank-transactions`,
  periodClosures: `${STORAGE_PREFIX}period-closures`,
  cashCountVariances: `${STORAGE_PREFIX}cash-count-variances`,
  checkNotes: `${STORAGE_PREFIX}check-notes`,
  stockAdjustments: `${STORAGE_PREFIX}stock-adjustments`,
  journalVouchers: `${STORAGE_PREFIX}journal-vouchers`,
  equityPartners: `${STORAGE_PREFIX}equity-partners`,
  capitalContributions: `${STORAGE_PREFIX}capital-contributions`,
} as const;

function loadArray<T>(key: string): T[] {
  const stored = localStorage.getItem(key);
  if (!stored) return [];
  try {
    return JSON.parse(stored) as T[];
  } catch {
    return [];
  }
}

export function loadAccountingSnapshot(): AccountingSnapshot {
  return {
    suppliers: loadArray(KEYS.suppliers),
    customerLedger: loadArray(KEYS.customerLedger),
    supplierLedger: loadArray(KEYS.supplierLedger),
    bankAccounts: loadArray(KEYS.bankAccounts),
    bankTransactions: loadArray(KEYS.bankTransactions),
    periodClosures: loadArray(KEYS.periodClosures),
    cashCountVariances: loadArray(KEYS.cashCountVariances),
    checkNotes: loadArray(KEYS.checkNotes),
    stockAdjustments: loadArray(KEYS.stockAdjustments),
    journalVouchers: loadArray(KEYS.journalVouchers),
    equityPartners: loadEquityPartners(),
    capitalContributions: loadArray(KEYS.capitalContributions),
  };
}

function loadEquityPartners() {
  const stored = loadArray<AccountingSnapshot['equityPartners'][number]>(KEYS.equityPartners);
  return stored.length > 0 ? stored : createDefaultEquityPartners();
}

export function saveAccountingSnapshot(snapshot: AccountingSnapshot): void {
  localStorage.setItem(KEYS.suppliers, JSON.stringify(snapshot.suppliers));
  localStorage.setItem(KEYS.customerLedger, JSON.stringify(snapshot.customerLedger));
  localStorage.setItem(KEYS.supplierLedger, JSON.stringify(snapshot.supplierLedger));
  localStorage.setItem(KEYS.bankAccounts, JSON.stringify(snapshot.bankAccounts));
  localStorage.setItem(KEYS.bankTransactions, JSON.stringify(snapshot.bankTransactions));
  localStorage.setItem(KEYS.periodClosures, JSON.stringify(snapshot.periodClosures));
  localStorage.setItem(KEYS.cashCountVariances, JSON.stringify(snapshot.cashCountVariances));
  localStorage.setItem(KEYS.checkNotes, JSON.stringify(snapshot.checkNotes));
  localStorage.setItem(KEYS.stockAdjustments, JSON.stringify(snapshot.stockAdjustments));
  localStorage.setItem(KEYS.journalVouchers, JSON.stringify(snapshot.journalVouchers));
  localStorage.setItem(KEYS.equityPartners, JSON.stringify(snapshot.equityPartners));
  localStorage.setItem(KEYS.capitalContributions, JSON.stringify(snapshot.capitalContributions));
}

export function mergeAccountingFromPersisted(
  remote: Partial<AccountingSnapshot> | undefined,
): AccountingSnapshot {
  const local = loadAccountingSnapshot();
  if (!remote) return local;
  return {
    suppliers: remote.suppliers ?? local.suppliers,
    customerLedger: remote.customerLedger ?? local.customerLedger,
    supplierLedger: remote.supplierLedger ?? local.supplierLedger,
    bankAccounts: remote.bankAccounts ?? local.bankAccounts,
    bankTransactions: remote.bankTransactions ?? local.bankTransactions,
    periodClosures: remote.periodClosures ?? local.periodClosures,
    cashCountVariances: remote.cashCountVariances ?? local.cashCountVariances,
    checkNotes: remote.checkNotes ?? local.checkNotes,
    stockAdjustments: remote.stockAdjustments ?? local.stockAdjustments,
    journalVouchers: remote.journalVouchers ?? local.journalVouchers,
    equityPartners: remote.equityPartners?.length ? remote.equityPartners : local.equityPartners,
    capitalContributions: remote.capitalContributions ?? local.capitalContributions,
  };
}

export function accountingFieldsFromSnapshot(snapshot: AccountingSnapshot) {
  return { ...snapshot };
}

export { EMPTY_ACCOUNTING_SNAPSHOT, KEYS as ACCOUNTING_STORAGE_KEYS };
