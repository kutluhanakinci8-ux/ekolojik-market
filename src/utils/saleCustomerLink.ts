import type { Customer } from '../types/business';
import type { Sale } from '../types/product';
import { normalizeGreenleafNumber } from './customerValidation';

export function findCustomerBySaleGl(
  sale: Pick<Sale, 'greenleafNumber'>,
  customers: Customer[],
): Customer | undefined {
  const gl = sale.greenleafNumber ? normalizeGreenleafNumber(sale.greenleafNumber) : undefined;
  if (!gl) return undefined;
  return customers.find((c) => normalizeGreenleafNumber(c.greenleafNumber ?? '') === gl);
}

/**
 * Satışın müşteri profiline / cari hesaba bağlanması.
 * Kayıtlı Greenleaf no ile tamamlanan satışlar müşteriye yazılır.
 */
export function isSaleCustomerAttributed(
  sale: Pick<Sale, 'customerId' | 'customerName' | 'paymentMethod' | 'greenleafNumber'>,
  customers: Customer[] = [],
): boolean {
  if (sale.paymentMethod === 'credit') return true;
  if (sale.customerName?.trim()) return true;
  if (sale.customerId && customers.some((c) => c.id === sale.customerId)) return true;
  return Boolean(findCustomerBySaleGl(sale, customers));
}

/** Satış kaydını müşteri listesiyle eşleştirir. */
export function resolveSaleCustomerId(
  sale: Pick<Sale, 'customerId' | 'greenleafNumber' | 'customerName' | 'paymentMethod'>,
  customers: Customer[],
): string | undefined {
  if (!isSaleCustomerAttributed(sale, customers)) {
    return undefined;
  }

  if (sale.customerId && customers.some((c) => c.id === sale.customerId)) {
    return sale.customerId;
  }

  const byGl = findCustomerBySaleGl(sale, customers);
  if (byGl) return byGl.id;

  const name = sale.customerName?.trim().toLowerCase();
  if (name) {
    const byName = customers.find((c) => c.name.toLowerCase() === name);
    if (byName) return byName.id;
  }

  return undefined;
}

export function isSaleLinkedToCustomer(
  sale: Sale,
  customerId: string,
  customers: Customer[],
): boolean {
  return resolveSaleCustomerId(sale, customers) === customerId;
}

/** Eksik müşteri bağlarını tamamlar; GL ile kayıtlı müşteri satışlarını düzeltir. */
export function repairSaleCustomerLinks(sales: Sale[], customers: Customer[]): Sale[] {
  let changed = false;
  const next = sales.map((sale) => {
    const byGl = findCustomerBySaleGl(sale, customers);

    if (byGl) {
      const nextName = sale.customerName?.trim() || byGl.name;
      if (sale.customerId !== byGl.id || sale.customerName !== nextName) {
        changed = true;
        return { ...sale, customerId: byGl.id, customerName: nextName };
      }
      return sale;
    }

    if (sale.customerId && !isSaleCustomerAttributed(sale, customers)) {
      changed = true;
      return { ...sale, customerId: undefined, customerName: undefined };
    }

    if (sale.customerId && !sale.customerName?.trim()) {
      const owner = customers.find((c) => c.id === sale.customerId);
      if (owner) {
        changed = true;
        return { ...sale, customerName: owner.name };
      }
    }

    return sale;
  });
  return changed ? next : sales;
}

/** @deprecated repairSaleCustomerLinks kullanın */
export function relinkSalesToCustomers(sales: Sale[], customers: Customer[]): Sale[] {
  return repairSaleCustomerLinks(sales, customers);
}
