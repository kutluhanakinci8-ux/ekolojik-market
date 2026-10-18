import type { AccountingSnapshot } from './accounting';
import type { AppSettings, CashHandover, Customer, DailyCashSession, Expense, PurchaseInvoice } from './business';
import type { PriceType, Product, Sale, StockMovement } from './product';
import type { SaleReturn } from './saleReturn';
import type { ProductSet } from './productSet';
import type { LoginAuditEntry } from './security';
import type { ActivityAuditEntry } from '../utils/activityAudit';
import type { PosUser } from './user';
import type { CrmPersistedData } from './crm';

export interface PersistedStoreSnapshot {
  updatedAt: string;
  products: Product[];
  productSets?: ProductSet[];
  sales: Sale[];
  saleReturns?: SaleReturn[];
  stockMovements: StockMovement[];
  customers: Customer[];
  expenses: Expense[];
  cashHandovers?: CashHandover[];
  cashSessions?: DailyCashSession[];
  purchaseInvoices?: PurchaseInvoice[];
  settings: AppSettings;
  priceType: PriceType;
  users?: PosUser[];
  loginAuditLog?: LoginAuditEntry[];
  activityAuditLog?: ActivityAuditEntry[];
  suppliers?: AccountingSnapshot['suppliers'];
  customerLedger?: AccountingSnapshot['customerLedger'];
  supplierLedger?: AccountingSnapshot['supplierLedger'];
  bankAccounts?: AccountingSnapshot['bankAccounts'];
  bankTransactions?: AccountingSnapshot['bankTransactions'];
  periodClosures?: AccountingSnapshot['periodClosures'];
  cashCountVariances?: AccountingSnapshot['cashCountVariances'];
  checkNotes?: AccountingSnapshot['checkNotes'];
  stockAdjustments?: AccountingSnapshot['stockAdjustments'];
  journalVouchers?: AccountingSnapshot['journalVouchers'];
  equityPartners?: AccountingSnapshot['equityPartners'];
  capitalContributions?: AccountingSnapshot['capitalContributions'];
  crm?: CrmPersistedData;
}

export function hasPersistedStoreData(snapshot: Partial<PersistedStoreSnapshot> | null | undefined): boolean {
  if (!snapshot) return false;
  if (snapshot.sales?.length) return true;
  if (snapshot.stockMovements?.length) return true;
  if (snapshot.customers?.length) return true;
  if (snapshot.expenses?.length) return true;
  if (snapshot.purchaseInvoices?.length) return true;
  if (snapshot.products?.some((product) => product.stock > 0)) return true;
  return false;
}
