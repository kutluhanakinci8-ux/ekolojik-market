import type { PurchaseInvoice } from '../types/business';

export interface SupplierPurchaseSummary {
  invoiceCount: number;
  totalGross: number;
  unpaidGross: number;
}

export function getSupplierPurchaseSummary(
  supplierId: string,
  purchaseInvoices: PurchaseInvoice[],
): SupplierPurchaseSummary {
  const invoices = purchaseInvoices.filter((invoice) => invoice.supplierId === supplierId);
  let totalGross = 0;
  let unpaidGross = 0;
  for (const invoice of invoices) {
    totalGross += invoice.grossAmount;
    const paid = invoice.paidAmount ?? 0;
    if (invoice.paymentStatus !== 'paid') {
      unpaidGross += Math.max(0, invoice.grossAmount - paid);
    }
  }
  return {
    invoiceCount: invoices.length,
    totalGross: Math.round(totalGross * 100) / 100,
    unpaidGross: Math.round(unpaidGross * 100) / 100,
  };
}
