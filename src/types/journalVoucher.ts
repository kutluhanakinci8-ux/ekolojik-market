import type { PurchaseInvoiceLine } from './accounting';
import type { CustomExpenseCategory, ExpenseCategory } from './business';

export type BankMovementKind =
  | 'cash_to_bank'
  | 'bank_to_cash'
  | 'customer_collection'
  | 'customer_refund'
  | 'expense_payment'
  | 'supplier_payment'
  | 'supplier_refund';

export type VoucherTransactionType =
  | 'customer_collection'
  | 'supplier_payment'
  | 'expense'
  | 'bank_movement'
  | 'bank_deposit'
  | 'bank_withdrawal'
  | 'purchase_invoice'
  | 'check_received'
  | 'cash_variance'
  | 'partner_capital';

export type VoucherPaymentSource = 'cash' | 'bank' | 'check' | 'card';

export interface JournalLine {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

export type JournalVoucherStatus = 'active' | 'voided';

export interface JournalVoucher {
  id: string;
  voucherNo: string;
  transactionType: VoucherTransactionType;
  date: string;
  description: string;
  lines: JournalLine[];
  amount: number;
  paymentSource?: VoucherPaymentSource;
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  bankAccountId?: string;
  bankAccountName?: string;
  partnerId?: string;
  partnerName?: string;
  partnerAccountCode?: string;
  documentNo?: string;
  sourceRefId?: string;
  linkedSaleId?: string;
  linkedSaleReturnId?: string;
  linkedBankTransactionId?: string;
  linkedCheckNoteId?: string;
  currency?: string;
  amountForeign?: number;
  exchangeRate?: number;
  attachmentName?: string;
  attachmentDataUrl?: string;
  bankMovementKind?: BankMovementKind;
  status?: JournalVoucherStatus;
  voidedAt?: string;
  voidReason?: string;
  createdAt: string;
  createdBy?: string;
}

export interface VoucherInput {
  type: VoucherTransactionType;
  date: string;
  description: string;
  amount: number;
  paymentSource?: VoucherPaymentSource;
  bankAccountId?: string;
  customerId?: string;
  supplierId?: string;
  supplierName?: string;
  expenseCategory?: ExpenseCategory;
  customExpenseCategories?: CustomExpenseCategory[];
  bankMovementKind?: BankMovementKind;
  documentNo?: string;
  vatRate?: number;
  invoiceNo?: string;
  invoiceDate?: string;
  productId?: number;
  quantity?: number;
  unitCostNet?: number;
  affectsStock?: boolean;
  purchaseLines?: PurchaseInvoiceLine[];
  checkDrawer?: string;
  checkDueDate?: string;
  systemBalance?: number;
  countedBalance?: number;
  partnerId?: string;
  partnerAccountCode?: string;
  partnerName?: string;
  currency?: string;
  exchangeRate?: number;
  amountForeign?: number;
  linkedSaleId?: string;
  linkedSaleReturnId?: string;
  attachmentName?: string;
  attachmentDataUrl?: string;
}

export const VOUCHER_TYPE_LABELS: Record<VoucherTransactionType, string> = {
  customer_collection: 'Müşteri Tahsilat',
  supplier_payment: 'Tedarikçi Ödeme',
  expense: 'Gider',
  bank_movement: 'Banka İşlemi',
  bank_deposit: 'Banka Para Girişi',
  bank_withdrawal: 'Banka Para Çıkışı',
  purchase_invoice: 'Alış Faturası',
  check_received: 'Çek / Senet Alınan',
  cash_variance: 'Kasa Sayım Farkı',
  partner_capital: 'Ortak Sermaye Girişi',
};
