import type { ExpenseCategory } from '../types/business';
import type { VoucherInput, VoucherTransactionType } from '../types/journalVoucher';
import { resolveVoucherAmount } from './journalVoucherBuilder';

export type VoucherFieldErrors = Partial<Record<string, string>>;

export function parseAmountInput(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const normalized = trimmed
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const n = parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}

export function formatAmountInput(value: number): string {
  if (!value || value <= 0) return '';
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatAmountInputFromString(value: string): string {
  if (!value.trim()) return '';
  const parsed = parseAmountInput(value);
  if (parsed <= 0) return value;
  return formatAmountInput(parsed);
}

export function buildAutoDescription(
  type: VoucherTransactionType,
  opts: { customerName?: string; supplierName?: string; expenseLabel?: string },
): string {
  if (type === 'customer_collection' && opts.customerName) {
    return `${opts.customerName} — tahsilat`;
  }
  if (type === 'supplier_payment' && opts.supplierName) {
    return `${opts.supplierName} — ödeme`;
  }
  if (type === 'expense' && opts.expenseLabel) {
    return opts.expenseLabel;
  }
  if (type === 'check_received' && opts.customerName) {
    return `${opts.customerName} — çek/senet`;
  }
  if (type === 'purchase_invoice' && opts.supplierName) {
    return `${opts.supplierName} — alış faturası`;
  }
  return '';
}

export function validateVoucherInput(
  input: VoucherInput,
  bankAccountCount: number,
): VoucherFieldErrors {
  const errors: VoucherFieldErrors = {};
  const amount = resolveVoucherAmount(input);

  if (!input.date) errors.date = 'Tarih gerekli';

  switch (input.type) {
    case 'customer_collection': {
      if (!input.customerId) errors.customerId = 'Müşteri seçin';
      const foreignCollection = Boolean(input.currency && input.currency !== 'TRY');
      if (foreignCollection) {
        if (!input.amountForeign || input.amountForeign <= 0) {
          errors.amountForeign = 'Döviz tutarı girin';
        }
        if (!input.exchangeRate || input.exchangeRate <= 0) {
          errors.exchangeRate = 'Geçerli kur girin';
        }
      } else if (amount <= 0) {
        errors.amount = 'Geçerli tutar girin';
      }
      if (input.paymentSource === 'bank' && bankAccountCount > 0 && !input.bankAccountId) {
        errors.bankAccountId = 'Banka hesabı seçin';
      }
      if (bankAccountCount === 0 && input.paymentSource === 'bank') {
        errors.bankAccountId = 'Önce Dönem & Diğer sekmesinden banka hesabı tanımlayın';
      }
      break;
    }
    case 'supplier_payment':
      if (!input.supplierId && !input.supplierName?.trim()) {
        errors.supplierName = 'Tedarikçi seçin veya ad yazın';
      }
      if (amount <= 0) errors.amount = 'Geçerli tutar girin';
      if (input.paymentSource === 'bank' && bankAccountCount > 0 && !input.bankAccountId) {
        errors.bankAccountId = 'Banka hesabı seçin';
      }
      break;
    case 'expense':
      if (!input.description?.trim()) errors.description = 'Açıklama zorunlu';
      if (amount <= 0) errors.amount = 'Geçerli tutar girin';
      if (input.paymentSource === 'bank' && bankAccountCount > 0 && !input.bankAccountId) {
        errors.bankAccountId = 'Banka hesabı seçin';
      }
      break;
    case 'bank_movement': {
      if (!input.bankAccountId) errors.bankAccountId = 'Banka hesabı seçin';
      if (bankAccountCount === 0) errors.bankAccountId = 'Önce Dönem & Diğer sekmesinden banka hesabı tanımlayın';
      if (amount <= 0) errors.amount = 'Geçerli tutar girin';
      const kind = input.bankMovementKind ?? 'cash_to_bank';
      if (kind === 'customer_collection' || kind === 'customer_refund') {
        if (!input.customerId) errors.customerId = 'Müşteri seçin';
      }
      if (kind === 'supplier_payment' || kind === 'supplier_refund') {
        if (!input.supplierId && !input.supplierName?.trim()) {
          errors.supplierName = 'Tedarikçi seçin veya ad yazın';
        }
      }
      if (kind === 'expense_payment' && !input.description?.trim()) {
        errors.description = 'Açıklama zorunlu';
      }
      break;
    }
    case 'bank_deposit':
    case 'bank_withdrawal':
      if (!input.bankAccountId) errors.bankAccountId = 'Banka hesabı seçin';
      if (amount <= 0) errors.amount = 'Geçerli tutar girin';
      if (bankAccountCount === 0) errors.bankAccountId = 'Banka hesabı tanımlı değil';
      break;
    case 'purchase_invoice': {
      const affectsStock = input.affectsStock ?? true;
      if (!input.invoiceNo?.trim()) errors.invoiceNo = 'Fatura no gerekli';
      if (!input.supplierName?.trim() && !input.supplierId) errors.supplierName = 'Tedarikçi gerekli';
      if (affectsStock) {
        const lines = input.purchaseLines?.length
          ? input.purchaseLines
          : (input.productId
            ? [{
              productId: input.productId,
              quantity: input.quantity ?? 0,
              unitCostNet: input.unitCostNet ?? 0,
              vatRate: input.vatRate ?? 0,
            }]
            : []);
        if (lines.length === 0) {
          errors.purchaseLines = 'En az bir geçerli fatura satırı girin';
        } else {
          const invalid = lines.find(
            (line) => line.quantity <= 0 || line.unitCostNet <= 0,
          );
          if (invalid) errors.purchaseLines = 'Tüm satırlarda ürün, adet ve birim maliyet zorunlu';
        }
      } else if (amount <= 0) {
        errors.amount = 'KDV dahil tutar girin';
      }
      break;
    }
    case 'check_received':
      if (!input.customerId) errors.customerId = 'Müşteri seçin';
      if (!input.checkDrawer?.trim()) errors.checkDrawer = 'Keşideci gerekli';
      if (amount <= 0) errors.amount = 'Geçerli tutar girin';
      break;
    case 'partner_capital':
      if (!input.partnerId) errors.partnerId = 'Ortak seçin';
      if (amount <= 0) errors.amount = 'Geçerli tutar girin';
      if (input.paymentSource === 'bank' && bankAccountCount > 0 && !input.bankAccountId) {
        errors.bankAccountId = 'Banka hesabı seçin';
      }
      break;
    case 'cash_variance':
      if (input.systemBalance == null) errors.systemBalance = 'Sistem bakiye gerekli';
      if (input.countedBalance == null || input.countedBalance === 0 && !input.description) {
        if (!input.countedBalance && input.countedBalance !== 0) {
          errors.countedBalance = 'Sayılan bakiye girin';
        }
      }
      break;
    default:
      break;
  }

  return errors;
}

export function getVoucherPreviewEmptyMessage(
  type: VoucherTransactionType,
  input: VoucherInput,
  customerId?: string,
): string {
  if (type === 'customer_collection') {
    if (!customerId) return 'Önce müşteri seçin';
    const amount = resolveVoucherAmount(input);
    if (amount <= 0) return 'Tutar girin';
    return 'Önizleme hazırlanıyor…';
  }
  if (type === 'check_received' && !customerId) return 'Önce müşteri seçin';
  const amount = resolveVoucherAmount(input);
  if (amount <= 0) return 'Tutar ve zorunlu alanları girin';
  return 'Tutar ve zorunlu alanları girin';
}

const PAYMENT_SOURCE_LABELS: Record<string, string> = {
  cash: 'Kasa (100)',
  bank: 'Banka (102)',
  check: 'Çek/Senet (101)',
  card: 'Kredi Kartı (102)',
};

export function paymentSourceLabel(source?: string): string {
  if (!source) return '—';
  return PAYMENT_SOURCE_LABELS[source] ?? source;
}

export function isForeignVoucherType(type: VoucherTransactionType): boolean {
  return type === 'partner_capital' || type === 'customer_collection';
}

export interface ExpenseTemplate {
  id: string;
  label: string;
  category: ExpenseCategory;
  description: string;
}

export const EXPENSE_TEMPLATES: ExpenseTemplate[] = [
  { id: 'rent', label: 'Kira', category: 'rent', description: 'Aylık kira ödemesi' },
  { id: 'electric', label: 'Elektrik', category: 'utilities', description: 'Elektrik faturası' },
  { id: 'water', label: 'Su / Doğalgaz', category: 'utilities', description: 'Su veya doğalgaz faturası' },
  { id: 'salary', label: 'Personel', category: 'salary', description: 'Personel ödemesi' },
  { id: 'supplies', label: 'Sarf Malzeme', category: 'supplies', description: 'Mağaza sarf malzemesi' },
  { id: 'sgk', label: 'SGK / Vergi', category: 'other', description: 'SGK veya vergi ödemesi' },
];
