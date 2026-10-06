import type { Customer } from '../../types/business';
import type { Sale } from '../../types/product';
import type { CustomerLedgerEntry } from '../../types/accounting';
import type { CrmSavedSegment, CrmSegmentRule } from '../../types/crm';
import { getCustomerOpenBalance } from './credit';
import { getCustomerCrmProfile } from './profile';
import type { CrmSettings } from '../../types/crm';
import { resolveSaleCustomerId } from '../saleCustomerLink';
import { getSaleNetTotal } from '../saleReturn';
import type { SaleReturn } from '../../types/saleReturn';

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

function lastPurchaseDate(
  customerId: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
): string | null {
  let latest: string | null = null;
  for (const sale of sales) {
    const cid = resolveSaleCustomerId(sale, customers);
    if (cid !== customerId) continue;
    if (getSaleNetTotal(sale, saleReturns) <= 0) continue;
    if (!latest || sale.createdAt > latest) latest = sale.createdAt;
  }
  return latest;
}

function lifetimeSpend(
  customerId: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
): number {
  let total = 0;
  for (const sale of sales) {
    const cid = resolveSaleCustomerId(sale, customers);
    if (cid !== customerId) continue;
    total += getSaleNetTotal(sale, saleReturns);
  }
  return Math.round(total * 100) / 100;
}

function evalRule(
  rule: CrmSegmentRule,
  customer: Customer,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
  ledger: CustomerLedgerEntry[],
  settings: CrmSettings,
): boolean {
  const crm = getCustomerCrmProfile(customer, settings);
  let left: number | string = 0;
  switch (rule.field) {
    case 'days_since_purchase': {
      const last = lastPurchaseDate(customer.id, sales, saleReturns, customers);
      left = last ? daysSince(last) : 9999;
      break;
    }
    case 'lifetime_spend':
      left = lifetimeSpend(customer.id, sales, saleReturns, customers);
      break;
    case 'open_balance':
      left = getCustomerOpenBalance(customer.id, ledger);
      break;
    case 'loyalty_tier':
      left = crm.loyaltyTier;
      break;
    case 'tag':
      left = crm.tagIds.includes(rule.value) ? '1' : '0';
      break;
    default:
      return false;
  }

  const rightNum = parseFloat(rule.value);
  if (rule.field === 'loyalty_tier' || rule.field === 'tag') {
    if (rule.operator === 'eq') return String(left) === rule.value;
    if (rule.field === 'tag') return left === '1';
    return false;
  }

  const leftNum = typeof left === 'number' ? left : parseFloat(String(left));
  switch (rule.operator) {
    case 'gt': return leftNum > rightNum;
    case 'gte': return leftNum >= rightNum;
    case 'lt': return leftNum < rightNum;
    case 'lte': return leftNum <= rightNum;
    case 'eq': return leftNum === rightNum;
    default: return false;
  }
}

export function customerMatchesSegment(
  segment: CrmSavedSegment,
  customer: Customer,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
  ledger: CustomerLedgerEntry[],
  settings: CrmSettings,
): boolean {
  if (segment.rules.length === 0) return true;
  return segment.rules.every((rule) => evalRule(rule, customer, sales, saleReturns, customers, ledger, settings));
}

export function listMatchingSegmentIds(
  segments: CrmSavedSegment[],
  customer: Customer,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
  ledger: CustomerLedgerEntry[],
  settings: CrmSettings,
): string[] {
  return segments
    .filter((s) => customerMatchesSegment(s, customer, sales, saleReturns, customers, ledger, settings))
    .map((s) => s.id);
}

export function filterCustomersBySegment(
  segment: CrmSavedSegment,
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[],
  ledger: CustomerLedgerEntry[],
  settings: CrmSettings,
): Customer[] {
  return customers.filter((c) => customerMatchesSegment(segment, c, sales, saleReturns, customers, ledger, settings));
}
