import type { Customer } from '../../types/business';
import type { Sale } from '../../types/product';
import type { SaleReturn } from '../../types/saleReturn';
import type { CustomerLedgerEntry } from '../../types/accounting';
import type { CrmManualActivity, CrmTimelineItem } from '../../types/crm';
import { resolveSaleCustomerId } from '../saleCustomerLink';
import { getSaleNetTotal } from '../saleReturn';

export function buildCustomerTimeline(
  customerId: string,
  sales: Sale[],
  saleReturns: SaleReturn[],
  customers: Customer[],
  ledger: CustomerLedgerEntry[],
  manualActivities: CrmManualActivity[],
): CrmTimelineItem[] {
  const items: CrmTimelineItem[] = [];

  for (const sale of sales) {
    if (resolveSaleCustomerId(sale, customers) !== customerId) continue;
    const net = getSaleNetTotal(sale, saleReturns);
    items.push({
      id: `tl-sale-${sale.id}`,
      at: sale.createdAt,
      kind: 'sale',
      title: `Satış ${sale.id}`,
      detail: sale.paymentMethod,
      amount: net,
    });
  }

  for (const ret of saleReturns) {
    const sale = sales.find((s) => s.id === ret.originalSaleId);
    const retCustomerId = sale ? resolveSaleCustomerId(sale, customers) : undefined;
    if (retCustomerId !== customerId) continue;
    items.push({
      id: `tl-ret-${ret.id}`,
      at: ret.createdAt,
      kind: 'return',
      title: `İade ${ret.id}`,
      detail: ret.reason,
      amount: -ret.refundTotal,
    });
  }

  for (const entry of ledger) {
    if (entry.customerId !== customerId) continue;
    if (entry.saleId && items.some((i) => i.id === `tl-sale-${entry.saleId}`)) continue;
    items.push({
      id: `tl-led-${entry.id}`,
      at: entry.createdAt,
      kind: entry.type === 'payment' ? 'payment' : 'payment',
      title: entry.note ?? entry.type,
      amount: entry.amount,
    });
  }

  for (const activity of manualActivities) {
    if (activity.customerId !== customerId) continue;
    items.push({
      id: `tl-man-${activity.id}`,
      at: activity.createdAt,
      kind: activity.kind,
      title: activity.title,
      detail: activity.detail,
    });
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}
