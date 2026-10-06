import type { Customer } from '../types/business';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { AuthSession } from '../types/user';
import { isSaleCustomerAttributed, resolveSaleCustomerId } from './saleCustomerLink';

/** Satış tarihinden itibaren kasiyerin görebildiği / iade alabileceği gün sayısı */
export const CASHIER_SALE_WINDOW_DAYS = 3;

const STAR_BLOCK = '******';

export function isCashierSession(session: AuthSession | null | undefined): boolean {
  return session?.role === 'cashier';
}

export function getCashierVisibilityCutoff(now = new Date()): Date {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - (CASHIER_SALE_WINDOW_DAYS - 1));
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

export function isSaleWithinCashierWindow(saleCreatedAt: string, now = new Date()): boolean {
  return new Date(saleCreatedAt) >= getCashierVisibilityCutoff(now);
}

export function isSaleReturnableByCashier(saleCreatedAt: string, now = new Date()): boolean {
  const saleDate = new Date(saleCreatedAt);
  const saleDay = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSince = Math.floor((today.getTime() - saleDay.getTime()) / (24 * 60 * 60 * 1000));
  return daysSince < CASHIER_SALE_WINDOW_DAYS;
}

export function filterSalesForCashier(sales: Sale[], now = new Date()): Sale[] {
  const cutoff = getCashierVisibilityCutoff(now);
  return sales.filter((sale) => new Date(sale.createdAt) >= cutoff);
}

export function filterReturnsForCashier(saleReturns: SaleReturn[], sales: Sale[], now = new Date()): SaleReturn[] {
  const visibleSaleIds = new Set(filterSalesForCashier(sales, now).map((sale) => sale.id));
  return saleReturns.filter((entry) => visibleSaleIds.has(entry.originalSaleId));
}

export function getCustomerIdsInCashierWindow(
  sales: Sale[],
  customers: Customer[] = [],
  now = new Date(),
): Set<string> {
  const ids = new Set<string>();
  for (const sale of filterSalesForCashier(sales, now)) {
    if (!isSaleCustomerAttributed(sale)) continue;
    const customerId = resolveSaleCustomerId(sale, customers);
    if (customerId) ids.add(customerId);
  }
  return ids;
}

export function maskCustomerName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '—';

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const initial = parts[0].charAt(0).toLocaleUpperCase('tr-TR');
    return `${initial}${STAR_BLOCK}`;
  }

  const firstInitial = parts[0].charAt(0).toLocaleUpperCase('tr-TR');
  const lastInitial = parts[parts.length - 1].charAt(0).toLocaleUpperCase('tr-TR');
  return `${firstInitial}${STAR_BLOCK} ${lastInitial}${STAR_BLOCK}`;
}

export function displayCustomerName(name: string | undefined | null, cashierMode: boolean): string {
  if (!name?.trim()) return '—';
  return cashierMode ? maskCustomerName(name) : name.trim();
}

export function getMaskedCustomerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toLocaleUpperCase('tr-TR');
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toLocaleUpperCase('tr-TR');
}

export const CASHIER_RETURN_EXPIRED_MESSAGE =
  'İade süresi doldu (satış tarihinden itibaren 3 gün). Yöneticinize başvurun.';

export const CASHIER_PRIVACY_NOTICE =
  'Kasiyer görünümü: Son 3 günlük kayıtlar gösterilir. Müşteri adları maskelenir; telefon görünmez. Süresi dolan iadeler için yöneticinize başvurun.';

export function customerMatchesCashierSearch(customer: Customer, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return customer.greenleafNumber?.toLowerCase().includes(q) ?? false;
}
