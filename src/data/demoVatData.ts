import type { PurchaseInvoice } from '../types/business';
import type { CartItem, Product, Sale } from '../types/product';
import { splitGrossAmount } from '../utils/vatAnalytics';
import { getProductSalePrice } from '../utils/salePricing';

const DEMO_INVOICE_SEED: Array<{
  invoiceNo: string;
  supplierName: string;
  invoiceDate: string;
  grossAmount: number;
  notes?: string;
}> = [
  { invoiceNo: 'ALF-2026-001', supplierName: 'Greenleaf Türkiye', invoiceDate: '2026-09-01', grossAmount: 12480, notes: 'Eylül açılış stok' },
  { invoiceNo: 'ALF-2026-002', supplierName: 'CARICH Distribütör', invoiceDate: '2026-09-02', grossAmount: 8640 },
  { invoiceNo: 'ALF-2026-003', supplierName: 'iLiFE Tedarik', invoiceDate: '2026-09-03', grossAmount: 7320 },
  { invoiceNo: 'ALF-2026-004', supplierName: 'SEALUXE Kozmetik', invoiceDate: '2026-09-04', grossAmount: 5880 },
  { invoiceNo: 'ALF-2026-005', supplierName: 'YIBEILE İthalat', invoiceDate: '2026-09-05', grossAmount: 4560 },
  { invoiceNo: 'ALF-2026-006', supplierName: 'Greenleaf Türkiye', invoiceDate: '2026-09-05', grossAmount: 9720 },
  { invoiceNo: 'ALF-2026-007', supplierName: 'Ambalaj Market', invoiceDate: '2026-09-06', grossAmount: 2160, notes: 'Koli ve etiket' },
  { invoiceNo: 'ALF-2026-008', supplierName: 'CARICH Distribütör', invoiceDate: '2026-09-07', grossAmount: 6480 },
  { invoiceNo: 'ALF-2026-009', supplierName: 'iLiFE Tedarik', invoiceDate: '2026-09-07', grossAmount: 5040 },
  { invoiceNo: 'ALF-2026-010', supplierName: 'Greenleaf Türkiye', invoiceDate: '2026-09-08', grossAmount: 11280, notes: 'Haftalık tamamlama' },
];

const DEMO_SALE_PLAN: Array<{ productId: number; quantity: number; dayOffset: number; payment: Sale['paymentMethod'] }> = [
  { productId: 1, quantity: 2, dayOffset: 0, payment: 'cash' },
  { productId: 19, quantity: 1, dayOffset: 0, payment: 'card' },
  { productId: 7, quantity: 1, dayOffset: 1, payment: 'cash' },
  { productId: 12, quantity: 2, dayOffset: 1, payment: 'transfer' },
  { productId: 36, quantity: 1, dayOffset: 2, payment: 'cash' },
  { productId: 8, quantity: 1, dayOffset: 3, payment: 'card' },
  { productId: 14, quantity: 3, dayOffset: 4, payment: 'cash' },
  { productId: 21, quantity: 1, dayOffset: 5, payment: 'cash' },
  { productId: 29, quantity: 1, dayOffset: 6, payment: 'card' },
  { productId: 5, quantity: 2, dayOffset: 7, payment: 'cash' },
];

export function createDemoPurchaseInvoices(): PurchaseInvoice[] {
  const now = new Date().toISOString();

  return DEMO_INVOICE_SEED.map((seed, index) => {
    const amounts = splitGrossAmount(seed.grossAmount, 20);
    return {
      id: `PI-DEMO-${index + 1}`,
      invoiceNo: seed.invoiceNo,
      supplierName: seed.supplierName,
      invoiceDate: seed.invoiceDate,
      grossAmount: amounts.grossAmount,
      vatRate: 20,
      netAmount: amounts.netAmount,
      vatAmount: amounts.vatAmount,
      notes: seed.notes,
      createdAt: now,
    };
  });
}

function buildDemoSale(
  plan: { productId: number; quantity: number; dayOffset: number; payment: Sale['paymentMethod'] },
  products: Product[],
  index: number,
): Sale | null {
  const product = products.find((item) => item.id === plan.productId);
  if (!product) return null;

  const unitPrice = getProductSalePrice(product, 'partner');
  const items: CartItem[] = [{
    productId: product.id,
    quantity: plan.quantity,
    priceType: 'partner',
    unitPrice,
  }];
  const total = unitPrice * plan.quantity;
  const createdAt = new Date();
  createdAt.setDate(createdAt.getDate() - plan.dayOffset);
  createdAt.setHours(10 + index, 15, 0, 0);

  return {
    id: `SDEMO-${index + 1}`,
    items,
    total,
    paymentMethod: plan.payment,
    createdAt: createdAt.toISOString(),
  };
}

export function createDemoSales(products: Product[]): Sale[] {
  return DEMO_SALE_PLAN
    .map((plan, index) => buildDemoSale(plan, products, index))
    .filter((sale): sale is Sale => sale != null);
}

export function isDemoSale(sale: Sale): boolean {
  return sale.id.startsWith('SDEMO-');
}

export function isDemoPurchaseInvoice(invoice: PurchaseInvoice): boolean {
  return invoice.id.startsWith('PI-DEMO-');
}
