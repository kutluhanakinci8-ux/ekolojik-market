import type { JournalVoucher } from '../types/journalVoucher';

export interface CashVirmanTotals {
  cashToBank: number;
  bankToCash: number;
  count: number;
}

export function isActiveCashVirmanVoucher(voucher: JournalVoucher): boolean {
  if (voucher.status === 'voided') return false;
  if (voucher.transactionType !== 'bank_movement') return false;
  return voucher.bankMovementKind === 'cash_to_bank' || voucher.bankMovementKind === 'bank_to_cash';
}

/** Fiş tarihi (YYYY-MM-DD) ile günlük kasa virman toplamları */
export function sumCashVirmanForDate(
  vouchers: JournalVoucher[],
  businessDateKey: string,
): CashVirmanTotals {
  let cashToBank = 0;
  let bankToCash = 0;
  let count = 0;

  for (const voucher of vouchers) {
    if (!isActiveCashVirmanVoucher(voucher) || voucher.date !== businessDateKey) continue;
    count += 1;
    if (voucher.bankMovementKind === 'cash_to_bank') {
      cashToBank += voucher.amount;
    } else {
      bankToCash += voucher.amount;
    }
  }

  return {
    cashToBank: Math.round(cashToBank * 100) / 100,
    bankToCash: Math.round(bankToCash * 100) / 100,
    count,
  };
}

export function listCashVirmanVouchersForDate(
  vouchers: JournalVoucher[],
  businessDateKey: string,
): JournalVoucher[] {
  return vouchers.filter(
    (voucher) => isActiveCashVirmanVoucher(voucher) && voucher.date === businessDateKey,
  );
}
