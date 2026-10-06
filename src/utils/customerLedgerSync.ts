import type { CustomerLedgerEntry } from '../types/accounting';
import type { Customer } from '../types/business';
import type { Sale } from '../types/product';
import { isSaleLinkedToCustomer, resolveSaleCustomerId } from './saleCustomerLink';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
  check: 'Çek',
};

/** Müşteriye bağlı satış için cari defter hareketleri (satış + anında ödeme). */
export function buildSaleLedgerEntries(
  sale: Sale,
  customerId: string,
  createdBy?: string,
): CustomerLedgerEntry[] {
  if (sale.total <= 0) return [];

  const createdAt = sale.createdAt;
  const base = { customerId, saleId: sale.id, createdAt, createdBy };

  if (sale.paymentMethod === 'credit') {
    return [{
      id: `CL-${sale.id}-credit`,
      type: 'sale_credit',
      amount: sale.total,
      dueDate: sale.dueDate,
      note: `Veresiye satış — ${sale.id}`,
      ...base,
    }];
  }

  const method = sale.paymentMethod === 'card' || sale.paymentMethod === 'transfer'
    ? sale.paymentMethod
    : 'cash';
  const methodLabel = PAYMENT_METHOD_LABELS[method] ?? method;

  return [
    {
      id: `CL-${sale.id}-sale`,
      type: 'sale',
      amount: sale.total,
      paymentMethod: method,
      note: `Satış — ${sale.id}`,
      ...base,
    },
    {
      id: `CL-${sale.id}-pay`,
      type: 'payment',
      amount: -sale.total,
      paymentMethod: method,
      note: `${methodLabel} ödeme — ${sale.id}`,
      customerId,
      saleId: sale.id,
      createdAt,
      createdBy,
    },
  ];
}

/** Eksik satış hareketlerini cari deftere ekler (idempotent). */
export function syncCustomerLedgerFromSales(
  sales: Sale[],
  customers: Customer[],
  ledger: CustomerLedgerEntry[],
): CustomerLedgerEntry[] {
  const saleIdsInLedger = new Set(
    ledger.filter((entry) => entry.saleId).map((entry) => entry.saleId as string),
  );
  const existingIds = new Set(ledger.map((entry) => entry.id));
  const additions: CustomerLedgerEntry[] = [];

  for (const sale of sales) {
    const customerId = resolveSaleCustomerId(sale, customers);
    if (!customerId || !isSaleLinkedToCustomer(sale, customerId, customers)) continue;
    if (sale.total <= 0 || saleIdsInLedger.has(sale.id)) continue;

    for (const entry of buildSaleLedgerEntries(sale, customerId, sale.cashierName)) {
      if (!existingIds.has(entry.id)) {
        additions.push(entry);
        existingIds.add(entry.id);
      }
    }
    saleIdsInLedger.add(sale.id);
  }

  if (additions.length === 0) return ledger;

  return [...ledger, ...additions].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}
