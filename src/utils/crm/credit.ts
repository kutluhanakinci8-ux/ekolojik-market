import type { Customer } from '../../types/business';
import type { CustomerLedgerEntry } from '../../types/accounting';
import { getCustomerBalance } from '../accountingAnalytics';
import { getCustomerCrmProfile } from './profile';
import type { CrmSettings } from '../../types/crm';

export function getCustomerOpenBalance(customerId: string, ledger: CustomerLedgerEntry[]): number {
  const entries = ledger.filter((e) => e.customerId === customerId);
  return getCustomerBalance(entries);
}

export function validateCreditSale(
  customer: Customer,
  additionalCredit: number,
  ledger: CustomerLedgerEntry[],
  settings: CrmSettings,
): string | null {
  const crm = getCustomerCrmProfile(customer, settings);
  if (crm.status === 'blacklist') return 'Müşteri kara listede — veresiye kapalı.';
  if (crm.status === 'cash_only') return 'Bu müşteri için yalnızca nakit/kart satışı.';
  if (crm.status === 'inactive' || crm.status === 'archived') return 'Pasif veya arşiv müşteri — satış onayı gerekir.';

  const limit = crm.creditLimit;
  if (limit == null || limit <= 0) return null;

  const open = getCustomerOpenBalance(customer.id, ledger);
  if (open + additionalCredit > limit) {
    return `Kredi limiti aşıldı (limit: ${limit.toFixed(2)} ₺, açık: ${open.toFixed(2)} ₺).`;
  }
  return null;
}

export function computeDueDateKey(defaultDueDays: number): string {
  const due = new Date();
  due.setDate(due.getDate() + Math.max(1, defaultDueDays));
  return `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, '0')}-${String(due.getDate()).padStart(2, '0')}`;
}
