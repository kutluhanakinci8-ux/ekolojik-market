/** Ön muhasebe — cari, banka, dönem, çek/senet, stok düzeltme */

import type { JournalVoucher } from './journalVoucher';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface PurchaseInvoiceLine {
  productId: number;
  quantity: number;
  /** KDV hariç birim maliyet */
  unitCostNet: number;
  vatRate: number;
  /** Kayıt sonrası ürün kartı güncellemesi (KDV dahil fiyatlar, PV sayı) */
  pv?: number;
  purchasePrice?: number;
  partnerPrice?: number;
  couponPrice?: number;
  fullSalePrice?: number;
  wholesalePrice?: number;
}

export interface Supplier {
  id: string;
  name: string;
  taxNumber?: string;
  taxOffice?: string;
  phone?: string;
  email?: string;
  address?: string;
  /** Varsayılan vade günü */
  paymentTermDays?: number;
  notes?: string;
  createdAt: string;
}

export type CustomerLedgerType = 'sale' | 'sale_credit' | 'payment' | 'return' | 'adjustment';

export interface CustomerLedgerEntry {
  id: string;
  customerId: string;
  type: CustomerLedgerType;
  /** Pozitif = alacak artışı, negatif = tahsilat / düşüş */
  amount: number;
  dueDate?: string;
  saleId?: string;
  paymentMethod?: 'cash' | 'card' | 'transfer' | 'check';
  reference?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export type SupplierLedgerType = 'invoice' | 'payment' | 'adjustment';

export interface SupplierLedgerEntry {
  id: string;
  supplierId: string;
  type: SupplierLedgerType;
  /** Pozitif = borç artışı, negatif = ödeme */
  amount: number;
  purchaseInvoiceId?: string;
  dueDate?: string;
  paymentMethod?: 'cash' | 'transfer' | 'check';
  reference?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export interface BankAccount {
  id: string;
  name: string;
  bankName: string;
  iban?: string;
  openingBalance: number;
  isActive: boolean;
  createdAt: string;
}

export type BankTransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'sale_transfer'
  | 'supplier_payment'
  | 'fee'
  | 'adjustment';

export interface BankTransaction {
  id: string;
  bankAccountId: string;
  type: BankTransactionType;
  amount: number;
  counterparty?: string;
  reference?: string;
  saleId?: string;
  purchaseInvoiceId?: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export interface PeriodClosure {
  id: string;
  /** YYYY-MM */
  periodKey: string;
  closedAt: string;
  closedBy?: string;
  notes?: string;
  snapshot: {
    netRevenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    receivables: number;
    payables: number;
    stockValue: number;
    vatPayable: number;
  };
}

export interface CashCountVariance {
  id: string;
  sessionDate: string;
  systemBalance: number;
  countedBalance: number;
  variance: number;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export type CheckNoteDirection = 'received' | 'issued';
export type CheckNoteKind = 'check' | 'promissory';
export type CheckNoteStatus = 'pending' | 'collected' | 'paid' | 'bounced' | 'cancelled';

export interface CheckNote {
  id: string;
  direction: CheckNoteDirection;
  kind: CheckNoteKind;
  amount: number;
  dueDate: string;
  drawer?: string;
  customerId?: string;
  supplierId?: string;
  status: CheckNoteStatus;
  bankName?: string;
  serialNo?: string;
  note?: string;
  createdAt: string;
}

export type StockAdjustmentType = 'count_diff' | 'waste' | 'fire' | 'other';

/** Yurtdışı / yerli ortak — sermaye hesabı (500.xx) */
export interface EquityPartner {
  id: string;
  name: string;
  country: string;
  /** Tek Düzen alt hesap — örn. 500.01 */
  accountCode: string;
  sharePercent?: number;
  isForeign: boolean;
  email?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

/** Ortak sermaye girişi kaydı */
export interface CapitalContribution {
  id: string;
  partnerId: string;
  /** TL karşılığı — muhasebe kaydı bu tutarla yapılır */
  amountTry: number;
  /** Orijinal döviz tutarı (varsa) */
  amountForeign?: number;
  currency?: string;
  exchangeRate?: number;
  contributionDate: string;
  paymentSource: 'cash' | 'bank';
  bankAccountId?: string;
  documentNo?: string;
  reference?: string;
  note?: string;
  journalVoucherId?: string;
  createdAt: string;
  createdBy?: string;
}

export interface StockAdjustment {
  id: string;
  productId: number;
  type: StockAdjustmentType;
  quantityDelta: number;
  unitCost: number;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export interface AccountingSnapshot {
  suppliers: Supplier[];
  customerLedger: CustomerLedgerEntry[];
  supplierLedger: SupplierLedgerEntry[];
  bankAccounts: BankAccount[];
  bankTransactions: BankTransaction[];
  periodClosures: PeriodClosure[];
  cashCountVariances: CashCountVariance[];
  checkNotes: CheckNote[];
  stockAdjustments: StockAdjustment[];
  journalVouchers: JournalVoucher[];
  equityPartners: EquityPartner[];
  capitalContributions: CapitalContribution[];
}

export const EMPTY_ACCOUNTING_SNAPSHOT: AccountingSnapshot = {
  suppliers: [],
  customerLedger: [],
  supplierLedger: [],
  bankAccounts: [],
  bankTransactions: [],
  periodClosures: [],
  cashCountVariances: [],
  checkNotes: [],
  stockAdjustments: [],
  journalVouchers: [],
  equityPartners: [],
  capitalContributions: [],
};
