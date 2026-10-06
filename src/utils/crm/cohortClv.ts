import type { Customer } from '../../types/business';
import type { Sale } from '../../types/product';
import type { SaleReturn } from '../../types/saleReturn';
import type { CustomerClvRow, CustomerCohortRow } from '../../types/crm';
import { resolveSaleCustomerId } from '../saleCustomerLink';
import { getSaleNetTotal } from '../saleReturn';

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

export function buildCustomerCohortRows(
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[],
): CustomerCohortRow[] {
  const firstPurchase = new Map<string, string>();
  const cohortCustomers = new Map<string, Set<string>>();
  const cohortRevenue = new Map<string, number>();

  for (const sale of sales) {
    const customerId = resolveSaleCustomerId(sale, customers);
    if (!customerId) continue;
    const net = getSaleNetTotal(sale, saleReturns);
    if (net <= 0) continue;
    if (!firstPurchase.has(customerId) || sale.createdAt < firstPurchase.get(customerId)!) {
      firstPurchase.set(customerId, sale.createdAt);
    }
    const cohort = monthKey(firstPurchase.get(customerId)!);
    if (!cohortCustomers.has(cohort)) cohortCustomers.set(cohort, new Set());
    cohortCustomers.get(cohort)!.add(customerId);
    cohortRevenue.set(cohort, (cohortRevenue.get(cohort) ?? 0) + net);
  }

  const repeatByCohort = new Map<string, number>();
  for (const [customerId, firstAt] of firstPurchase) {
    const cohort = monthKey(firstAt);
    const customerSales = sales.filter((s) => resolveSaleCustomerId(s, customers) === customerId);
    if (customerSales.length >= 2) {
      repeatByCohort.set(cohort, (repeatByCohort.get(cohort) ?? 0) + 1);
    }
  }

  return [...cohortCustomers.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 12)
    .map(([cohortMonth, set]) => {
      const count = set.size;
      const repeats = repeatByCohort.get(cohortMonth) ?? 0;
      return {
        cohortMonth,
        customerCount: count,
        repeatRate: count > 0 ? Math.round((repeats / count) * 100) : 0,
        revenue: Math.round((cohortRevenue.get(cohortMonth) ?? 0) * 100) / 100,
      };
    });
}

export function buildCustomerClvRows(
  customers: Customer[],
  sales: Sale[],
  saleReturns: SaleReturn[],
  limit = 15,
): CustomerClvRow[] {
  const map = new Map<string, { total: number; count: number; name: string }>();

  for (const sale of sales) {
    const customerId = resolveSaleCustomerId(sale, customers);
    if (!customerId) continue;
    const net = getSaleNetTotal(sale, saleReturns);
    if (net <= 0) continue;
    const customer = customers.find((c) => c.id === customerId);
    const existing = map.get(customerId) ?? {
      total: 0,
      count: 0,
      name: customer?.name ?? 'Müşteri',
    };
    existing.total += net;
    existing.count += 1;
    map.set(customerId, existing);
  }

  return [...map.entries()]
    .map(([customerId, row]) => ({
      customerId,
      customerName: row.name,
      orderCount: row.count,
      avgOrderValue: row.count > 0 ? Math.round((row.total / row.count) * 100) / 100 : 0,
      clvEstimate: Math.round(row.total * 100) / 100,
    }))
    .sort((a, b) => b.clvEstimate - a.clvEstimate)
    .slice(0, limit);
}
