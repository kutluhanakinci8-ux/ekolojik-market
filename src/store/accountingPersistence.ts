import { createDefaultEquityPartners } from '../data/defaultEquityPartners';
import type { AccountingSnapshot } from '../types/accounting';
import type { StockCountReport } from '../types/stockCountReport';
import { EMPTY_ACCOUNTING_SNAPSHOT } from '../types/accounting';
import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { tenantLocalStorageSuffix } from '../storage/posLocalStorageKeys';

const STORAGE_PREFIX = 'market-pos-accounting-';

type AccountingKeyId =
  | 'suppliers'
  | 'customerLedger'
  | 'supplierLedger'
  | 'bankAccounts'
  | 'bankTransactions'
  | 'periodClosures'
  | 'cashCountVariances'
  | 'checkNotes'
  | 'stockAdjustments'
  | 'stockCountReports'
  | 'journalVouchers'
  | 'equityPartners'
  | 'capitalContributions';

function storageKey(id: AccountingKeyId): string {
  return `${STORAGE_PREFIX}${id}${tenantLocalStorageSuffix()}`;
}

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
    suppliers: loadArray(storageKey('suppliers')),
    customerLedger: loadArray(storageKey('customerLedger')),
    supplierLedger: loadArray(storageKey('supplierLedger')),
    bankAccounts: loadArray(storageKey('bankAccounts')),
    bankTransactions: loadArray(storageKey('bankTransactions')),
    periodClosures: loadArray(storageKey('periodClosures')),
    cashCountVariances: loadArray(storageKey('cashCountVariances')),
    checkNotes: loadArray(storageKey('checkNotes')),
    stockAdjustments: loadArray(storageKey('stockAdjustments')),
    stockCountReports: loadArray(storageKey('stockCountReports')),
    journalVouchers: loadArray(storageKey('journalVouchers')),
    equityPartners: loadEquityPartners(),
    capitalContributions: loadArray(storageKey('capitalContributions')),
  };
}

function loadEquityPartners() {
  const stored = loadArray<AccountingSnapshot['equityPartners'][number]>(storageKey('equityPartners'));
  return stored.length > 0 ? stored : createDefaultEquityPartners();
}

export function saveAccountingSnapshot(snapshot: AccountingSnapshot): void {
  localStorage.setItem(storageKey('suppliers'), JSON.stringify(snapshot.suppliers));
  localStorage.setItem(storageKey('customerLedger'), JSON.stringify(snapshot.customerLedger));
  localStorage.setItem(storageKey('supplierLedger'), JSON.stringify(snapshot.supplierLedger));
  localStorage.setItem(storageKey('bankAccounts'), JSON.stringify(snapshot.bankAccounts));
  localStorage.setItem(storageKey('bankTransactions'), JSON.stringify(snapshot.bankTransactions));
  localStorage.setItem(storageKey('periodClosures'), JSON.stringify(snapshot.periodClosures));
  localStorage.setItem(storageKey('cashCountVariances'), JSON.stringify(snapshot.cashCountVariances));
  localStorage.setItem(storageKey('checkNotes'), JSON.stringify(snapshot.checkNotes));
  localStorage.setItem(storageKey('stockAdjustments'), JSON.stringify(snapshot.stockAdjustments));
  localStorage.setItem(storageKey('stockCountReports'), JSON.stringify(snapshot.stockCountReports));
  localStorage.setItem(storageKey('journalVouchers'), JSON.stringify(snapshot.journalVouchers));
  localStorage.setItem(storageKey('equityPartners'), JSON.stringify(snapshot.equityPartners));
  localStorage.setItem(storageKey('capitalContributions'), JSON.stringify(snapshot.capitalContributions));
}

function mergeStockCountReportsById(
  local: StockCountReport[],
  remote: StockCountReport[],
): StockCountReport[] {
  const map = new Map<string, StockCountReport>();
  for (const report of remote) {
    if (report?.id) map.set(report.id, report);
  }
  for (const report of local) {
    if (!report?.id) continue;
    const prev = map.get(report.id);
    if (!prev) {
      map.set(report.id, report);
      continue;
    }
    const localTs = Date.parse(report.inProgressAt ?? report.createdAt);
    const remoteTs = Date.parse(prev.inProgressAt ?? prev.createdAt);
    map.set(report.id, localTs >= remoteTs ? report : prev);
  }
  return [...map.values()].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function mergeAccountingFromPersisted(
  remote: Partial<AccountingSnapshot> | undefined,
): AccountingSnapshot {
  const isolated = loadTenantId() !== DEFAULT_TENANT_ID;
  if (isolated) {
    if (!remote) return loadAccountingSnapshot();
    return {
      suppliers: remote.suppliers ?? [],
      customerLedger: remote.customerLedger ?? [],
      supplierLedger: remote.supplierLedger ?? [],
      bankAccounts: remote.bankAccounts ?? [],
      bankTransactions: remote.bankTransactions ?? [],
      periodClosures: remote.periodClosures ?? [],
      cashCountVariances: remote.cashCountVariances ?? [],
      checkNotes: remote.checkNotes ?? [],
      stockAdjustments: remote.stockAdjustments ?? [],
      stockCountReports: remote.stockCountReports ?? [],
      journalVouchers: remote.journalVouchers ?? [],
      equityPartners: remote.equityPartners?.length ? remote.equityPartners : createDefaultEquityPartners(),
      capitalContributions: remote.capitalContributions ?? [],
    };
  }
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
    stockCountReports: mergeStockCountReportsById(
      local.stockCountReports,
      remote.stockCountReports ?? [],
    ),
    journalVouchers: remote.journalVouchers ?? local.journalVouchers,
    equityPartners: remote.equityPartners?.length ? remote.equityPartners : local.equityPartners,
    capitalContributions: remote.capitalContributions ?? local.capitalContributions,
  };
}

export function accountingFieldsFromSnapshot(snapshot: AccountingSnapshot) {
  return { ...snapshot };
}

export { EMPTY_ACCOUNTING_SNAPSHOT };
