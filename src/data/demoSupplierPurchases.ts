import type { PurchaseInvoiceLine, Supplier, SupplierLedgerEntry } from '../types/accounting';
import type { PurchaseInvoice } from '../types/business';
import type { Product, StockMovement } from '../types/product';
import { splitGrossAmount } from '../utils/vatAnalytics';

export const DEMO_SUPPLIER_ID = 'SUP-DEMO-EKOLOJIK';

const VAT_RATE = 20;

type DemoInvoiceSeed = {
  id: string;
  invoiceNo: string;
  invoiceDate: string;
  notes?: string;
  lines: Array<{ productId: number; quantity: number; unitCostNet: number }>;
};

const DEMO_INVOICE_SEEDS: DemoInvoiceSeed[] = [
  {
    id: 'PI-DEMO-SUP-1',
    invoiceNo: 'ALF-EKO-2026-001',
    invoiceDate: '2026-09-08',
    notes: 'Çamaşır jeli ve diş macunu alımı',
    lines: [
      { productId: 12, quantity: 10, unitCostNet: 183.5 },
      { productId: 19, quantity: 24, unitCostNet: 120.4 },
    ],
  },
  {
    id: 'PI-DEMO-SUP-2',
    invoiceNo: 'ALF-EKO-2026-002',
    invoiceDate: '2026-09-10',
    notes: 'Şampuan ve duş jeli alımı',
    lines: [
      { productId: 7, quantity: 8, unitCostNet: 245.7 },
      { productId: 36, quantity: 12, unitCostNet: 182.6 },
    ],
  },
];

function lineGrossAmount(line: PurchaseInvoiceLine): number {
  return line.quantity * line.unitCostNet * (1 + line.vatRate / 100);
}

function sumGross(lines: PurchaseInvoiceLine[]): number {
  const total = lines.reduce((sum, line) => sum + lineGrossAmount(line), 0);
  return Math.round(total * 100) / 100;
}

export function isDemoSupplier(supplier: Supplier): boolean {
  return supplier.id === DEMO_SUPPLIER_ID;
}

export function isDemoSupplierPurchaseInvoice(invoice: PurchaseInvoice): boolean {
  return invoice.id.startsWith('PI-DEMO-SUP-');
}

export function createDemoSupplier(): Supplier {
  const now = new Date().toISOString();
  return {
    id: DEMO_SUPPLIER_ID,
    name: 'Ekolojik Tedarik Ltd.',
    taxNumber: '1234567890',
    taxOffice: 'Muratpaşa',
    phone: '+90 242 123 45 67',
    email: 'siparis@ekolojiktedarik.example',
    paymentTermDays: 30,
    notes: 'Örnek tedarikçi — tedarikçi ödeme ve cari testleri için',
    createdAt: now,
  };
}

function buildLines(
  seed: DemoInvoiceSeed,
  products: Product[],
): PurchaseInvoiceLine[] | null {
  const lines: PurchaseInvoiceLine[] = [];
  for (const row of seed.lines) {
    const product = products.find((item) => item.id === row.productId);
    if (!product) return null;
    lines.push({
      productId: row.productId,
      quantity: row.quantity,
      unitCostNet: row.unitCostNet,
      vatRate: VAT_RATE,
    });
  }
  return lines;
}

export function createDemoSupplierPurchaseInvoices(products: Product[]): PurchaseInvoice[] | null {
  const createdAt = new Date().toISOString();
  const supplier = createDemoSupplier();
  const invoices: PurchaseInvoice[] = [];

  for (const seed of DEMO_INVOICE_SEEDS) {
    const lines = buildLines(seed, products);
    if (!lines?.length) return null;

    const grossAmount = sumGross(lines);
    const amounts = splitGrossAmount(grossAmount, VAT_RATE);
    const dueDate = addDaysIso(seed.invoiceDate, supplier.paymentTermDays ?? 30);

    invoices.push({
      id: seed.id,
      invoiceNo: seed.invoiceNo,
      supplierName: supplier.name,
      supplierId: DEMO_SUPPLIER_ID,
      invoiceDate: seed.invoiceDate,
      grossAmount: amounts.grossAmount,
      vatRate: VAT_RATE,
      netAmount: amounts.netAmount,
      vatAmount: amounts.vatAmount,
      notes: seed.notes,
      lines,
      affectsStock: true,
      paymentStatus: 'unpaid',
      paidAmount: 0,
      dueDate,
      createdAt,
    });
  }

  return invoices;
}

export function createDemoSupplierLedgerEntries(invoices: PurchaseInvoice[]): SupplierLedgerEntry[] {
  const now = new Date().toISOString();
  return invoices.map((invoice, index) => ({
    id: `SL-DEMO-SUP-${index + 1}`,
    supplierId: DEMO_SUPPLIER_ID,
    type: 'invoice',
    amount: invoice.grossAmount,
    purchaseInvoiceId: invoice.id,
    dueDate: invoice.dueDate,
    createdAt: now,
    createdBy: 'Demo',
  }));
}

function addDaysIso(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export type DemoSupplierStockUpdate = {
  products: Product[];
  movements: StockMovement[];
};

export function applyDemoSupplierStockUpdates(
  products: Product[],
  invoices: PurchaseInvoice[],
  createMovement: (
    product: Product,
    type: StockMovement['type'],
    quantity: number,
    previousStock: number,
    newStock: number,
    note?: string,
  ) => StockMovement,
): DemoSupplierStockUpdate {
  const movements: StockMovement[] = [];
  let nextProducts = products;

  for (const invoice of invoices) {
    if (!invoice.lines?.length) continue;
    nextProducts = nextProducts.map((product) => {
      const line = invoice.lines!.find((item) => item.productId === product.id);
      if (!line) return product;
      const previousStock = product.stock;
      const newStock = product.stock + line.quantity;
      const newPurchasePrice = Math.round(line.unitCostNet * (1 + line.vatRate / 100) * 100) / 100;
      movements.push(
        createMovement(
          product,
          'in',
          line.quantity,
          previousStock,
          newStock,
          `Alış faturası ${invoice.invoiceNo}`,
        ),
      );
      return {
        ...product,
        stock: newStock,
        purchasePrice: newPurchasePrice,
      };
    });
  }

  return { products: nextProducts, movements };
}

export function demoSupplierOutstandingBalance(invoices: PurchaseInvoice[]): number {
  return invoices.reduce((sum, invoice) => sum + invoice.grossAmount - (invoice.paidAmount ?? 0), 0);
}
