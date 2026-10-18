import type { BankMovementKind, VoucherInput, VoucherTransactionType } from '../types/journalVoucher';

export type { BankMovementKind };

export const BANK_MOVEMENT_KINDS: BankMovementKind[] = [
  'cash_to_bank',
  'bank_to_cash',
  'customer_collection',
  'customer_refund',
  'expense_payment',
  'supplier_payment',
  'supplier_refund',
];

export const BANK_MOVEMENT_KIND_LABELS: Record<BankMovementKind, string> = {
  cash_to_bank: 'Kasa → Banka (virman)',
  bank_to_cash: 'Banka → Kasa (virman)',
  customer_collection: 'Müşteri tahsilatı (banka)',
  customer_refund: 'Müşteri iadesi (bankadan ödeme)',
  expense_payment: 'Gider ödemesi (banka)',
  supplier_payment: 'Tedarikçi ödemesi (banka)',
  supplier_refund: 'Tedarikçiden iade (bankaya giriş)',
};

export function isBankMovementKind(value: string): value is BankMovementKind {
  return (BANK_MOVEMENT_KINDS as string[]).includes(value);
}

export function bankMovementKindNeedsCustomer(kind: BankMovementKind): boolean {
  return kind === 'customer_collection' || kind === 'customer_refund';
}

export function bankMovementKindNeedsSupplier(kind: BankMovementKind): boolean {
  return kind === 'supplier_payment' || kind === 'supplier_refund';
}

export function bankMovementKindNeedsExpenseFields(kind: BankMovementKind): boolean {
  return kind === 'expense_payment';
}

/** Eski fiş türlerini banka işlemine taşı */
export function legacyTypeToBankMovementKind(type: VoucherTransactionType): BankMovementKind | null {
  if (type === 'bank_deposit') return 'cash_to_bank';
  if (type === 'bank_withdrawal') return 'bank_to_cash';
  return null;
}

/**
 * Banka işlemi fişini yevmiye önizlemesi / kayıt için mantıksal fişe çevirir.
 */
/** Yevmiye önizlemesi için mantıksal fiş türü (iade türleri ayrı işlenir). */
export function resolveBankMovementPreviewInput(input: VoucherInput): VoucherInput | null {
  const kind = input.bankMovementKind ?? 'cash_to_bank';
  const base = { ...input, paymentSource: 'bank' as const };

  switch (kind) {
    case 'cash_to_bank':
      return { ...base, type: 'bank_deposit' };
    case 'bank_to_cash':
      return { ...base, type: 'bank_withdrawal' };
    case 'customer_collection':
      return { ...base, type: 'customer_collection' };
    case 'customer_refund':
    case 'supplier_refund':
      return null;
    case 'expense_payment':
      return { ...base, type: 'expense' };
    case 'supplier_payment':
      return { ...base, type: 'supplier_payment' };
    default:
      return { ...base, type: 'bank_deposit' };
  }
}
