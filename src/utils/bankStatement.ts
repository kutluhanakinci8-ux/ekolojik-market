import type { BankAccount, BankTransaction } from '../types/accounting';

export interface BankStatementRow {
  id: string;
  date: string;
  type: string;
  note?: string;
  reference?: string;
  debit: number;
  credit: number;
  balance: number;
}

const BANK_TX_LABELS: Record<BankTransaction['type'], string> = {
  deposit: 'Para girişi',
  withdrawal: 'Para çıkışı',
  sale_transfer: 'Satış havale',
  supplier_payment: 'Tedarikçi ödeme',
  fee: 'Banka masrafı',
  adjustment: 'Düzeltme / iptal',
};

export function bankTransactionTypeLabel(type: BankTransaction['type']): string {
  return BANK_TX_LABELS[type] ?? type;
}

export function buildBankStatement(
  bankAccountId: string,
  account: BankAccount,
  transactions: BankTransaction[],
): BankStatementRow[] {
  const entries = transactions
    .filter((tx) => tx.bankAccountId === bankAccountId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  let balance = account.openingBalance;
  const rows: BankStatementRow[] = [];

  for (const entry of entries) {
    const credit = entry.amount > 0 ? entry.amount : 0;
    const debit = entry.amount < 0 ? Math.abs(entry.amount) : 0;
    balance = Math.round((balance + entry.amount) * 100) / 100;
    rows.push({
      id: entry.id,
      date: entry.createdAt,
      type: bankTransactionTypeLabel(entry.type),
      note: entry.note,
      reference: entry.reference,
      debit,
      credit,
      balance,
    });
  }

  return rows;
}
