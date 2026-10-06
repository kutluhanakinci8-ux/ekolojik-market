import { getAccount, paymentSourceAccount } from '../data/chartOfAccounts';
import { resolveExpenseCategoryAccount } from './expenseCategories';
import { resolveBankMovementPreviewInput } from './bankMovement';
import type { CustomExpenseCategory, ExpenseCategory } from '../types/business';
import type { JournalLine, JournalVoucher, VoucherInput, VoucherTransactionType } from '../types/journalVoucher';
import { computePurchaseLinesTotals } from './purchaseInvoiceLines';
import { splitGrossAmount } from './vatAnalytics';

function line(
  accountCode: string,
  debit: number,
  credit: number,
  description?: string,
): JournalLine {
  const acc = getAccount(accountCode);
  return {
    accountCode,
    accountName: acc?.name ?? accountCode,
    debit: Math.round(debit * 100) / 100,
    credit: Math.round(credit * 100) / 100,
    description,
  };
}

function accountName(code: string): string {
  return getAccount(code)?.name ?? code;
}

export function resolveVoucherAmount(input: VoucherInput): number {
  const usesForeign = (input.type === 'partner_capital' || input.type === 'customer_collection')
    && input.currency
    && input.currency !== 'TRY'
    && input.amountForeign;
  if (usesForeign && input.exchangeRate) {
    return Math.round(input.amountForeign! * input.exchangeRate * 100) / 100;
  }
  if (input.type === 'partner_capital' && input.currency === 'TRY') {
    return input.amount;
  }
  if (input.type === 'cash_variance') {
    return Math.abs((input.countedBalance ?? 0) - (input.systemBalance ?? 0));
  }
  return input.amount;
}

export function buildJournalLinesPreview(input: VoucherInput): JournalLine[] {
  if (input.type === 'bank_movement') {
    const kind = input.bankMovementKind ?? 'cash_to_bank';
    const amount = Math.max(0, resolveVoucherAmount(input));
    if (amount <= 0) return [];
    if (kind === 'customer_refund') {
      const customerLabel = input.description?.trim() || 'Müşteri iadesi';
      return [
        line('120', amount, 0, customerLabel),
        line('102', 0, amount, accountName('102')),
      ];
    }
    if (kind === 'supplier_refund') {
      const supplierLabel = input.supplierName?.trim() || input.description?.trim() || 'Tedarikçi iadesi';
      return [
        line('102', amount, 0, supplierLabel),
        line('320', 0, amount, supplierLabel),
      ];
    }
    const previewInput = resolveBankMovementPreviewInput(input);
    if (previewInput) {
      return buildJournalLinesPreview(previewInput);
    }
    return [];
  }

  const amount = Math.max(0, resolveVoucherAmount(input));
  if (amount <= 0 && input.type !== 'cash_variance') return [];

  switch (input.type) {
    case 'customer_collection': {
      const payAcc = paymentSourceAccount(input.paymentSource ?? 'cash');
      const payName = accountName(payAcc);
      const foreignNote = input.currency && input.amountForeign && input.currency !== 'TRY'
        ? ` (${input.amountForeign} ${input.currency}${input.exchangeRate ? ` × ${input.exchangeRate}` : ''})`
        : '';
      const customerLabel = (input.description || 'Müşteri tahsilat') + foreignNote;
      return [
        line(payAcc, amount, 0, payName + foreignNote),
        line('120', 0, amount, customerLabel),
      ];
    }
    case 'supplier_payment': {
      const payAcc = paymentSourceAccount(input.paymentSource ?? 'bank');
      const supplierLabel = input.description || 'Tedarikçi ödeme';
      return [
        line('320', amount, 0, supplierLabel),
        line(payAcc, 0, amount, accountName(payAcc)),
      ];
    }
    case 'expense': {
      const rate = input.vatRate ?? 0;
      const split = rate > 0 ? splitGrossAmount(amount, rate) : { netAmount: amount, vatAmount: 0 };
      const expAcc = resolveExpenseCategoryAccount(
        input.expenseCategory ?? 'other',
        input.customExpenseCategories,
      );
      const payAcc = paymentSourceAccount(input.paymentSource ?? 'cash');
      const lines: JournalLine[] = [
        line(expAcc, split.netAmount, 0, input.description),
      ];
      if (split.vatAmount > 0) {
        lines.push(line('191', split.vatAmount, 0, 'İndirilecek KDV'));
      }
      lines.push(line(payAcc, 0, amount, accountName(payAcc)));
      return lines;
    }
    case 'bank_deposit':
      return [
        line('102', amount, 0, 'Banka giriş'),
        line('100', 0, amount, 'Kasadan bankaya'),
      ];
    case 'bank_withdrawal':
      return [
        line('100', amount, 0, 'Bankadan kasaya'),
        line('102', 0, amount, 'Banka çıkış'),
      ];
    case 'purchase_invoice': {
      const affectsStock = input.affectsStock ?? true;
      const stockLines = input.purchaseLines?.length
        ? input.purchaseLines
        : (input.productId
          ? [{
            productId: input.productId,
            quantity: input.quantity ?? 1,
            unitCostNet: input.unitCostNet ?? 0,
            vatRate: input.vatRate ?? 20,
          }]
          : []);
      const totals = stockLines.length > 0
        ? computePurchaseLinesTotals(stockLines)
        : splitGrossAmount(
          amount > 0 ? amount : 0,
          input.vatRate ?? 20,
        );
      const gross = stockLines.length > 0 ? totals.grossAmount : (amount > 0 ? amount : totals.grossAmount);
      const debitCode = affectsStock ? '153' : '770';
      const debitLabel = affectsStock ? 'Stok alış' : 'Alış gideri';
      const journalLines: JournalLine[] = [
        line(debitCode, totals.netAmount, 0, debitLabel),
      ];
      if (totals.vatAmount > 0) {
        journalLines.push(line('191', totals.vatAmount, 0, 'İndirilecek KDV'));
      }
      journalLines.push(line('320', 0, gross, input.supplierName ?? 'Tedarikçi borcu'));
      return journalLines;
    }
    case 'check_received':
      return [
        line('101', amount, 0, 'Alınan çek/senet'),
        line('120', 0, amount, input.checkDrawer ?? 'Müşteri'),
      ];
    case 'partner_capital': {
      if (amount <= 0 || !input.partnerAccountCode) return [];
      const payAcc = paymentSourceAccount(input.paymentSource ?? 'bank');
      const partnerLabel = input.partnerName
        ? `${input.partnerName} sermaye`
        : `${input.partnerAccountCode} sermaye girişi`;
      const foreignNote = input.currency && input.amountForeign
        ? ` (${input.amountForeign} ${input.currency}${input.exchangeRate ? ` × ${input.exchangeRate}` : ''})`
        : '';
      return [
        line(payAcc, amount, 0, `${accountName(payAcc)}${foreignNote}`),
        line(input.partnerAccountCode, 0, amount, partnerLabel),
      ];
    }
    case 'cash_variance': {
      const system = input.systemBalance ?? 0;
      const counted = input.countedBalance ?? 0;
      const diff = counted - system;
      if (diff === 0) return [];
      if (diff > 0) {
        return [
          line('100', diff, 0, 'Kasa fazlası'),
          line('679', 0, diff, 'Sayım farkı gelir'),
        ];
      }
      const abs = Math.abs(diff);
      return [
        line('679', abs, 0, 'Sayım farkı gider'),
        line('100', 0, abs, 'Kasa eksiği'),
      ];
    }
    default:
      return [];
  }
}

export function nextVoucherNo(existing: JournalVoucher[], dateKey: string): string {
  const prefix = dateKey.replace(/-/g, '');
  const sameDay = existing.filter((v) => v.date === dateKey);
  const seq = sameDay.length + 1;
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export function summarizeVoucherLines(lines: JournalLine[]): { totalDebit: number; totalCredit: number; balanced: boolean } {
  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
  const roundedDebit = Math.round(totalDebit * 100) / 100;
  const roundedCredit = Math.round(totalCredit * 100) / 100;
  return {
    totalDebit: roundedDebit,
    totalCredit: roundedCredit,
    balanced: Math.abs(roundedDebit - roundedCredit) < 0.01,
  };
}

export function voucherTypeIcon(type: VoucherTransactionType): string {
  switch (type) {
    case 'customer_collection': return '💵';
    case 'supplier_payment': return '🏭';
    case 'expense': return '🧾';
    case 'bank_movement': return '🏦';
    case 'bank_deposit': return '📥';
    case 'bank_withdrawal': return '📤';
    case 'purchase_invoice': return '📦';
    case 'check_received': return '📋';
    case 'cash_variance': return '⚖️';
    case 'partner_capital': return '🌍';
    default: return '📒';
  }
}

export function expenseCategoryLabel(
  category: ExpenseCategory,
  customCategories?: CustomExpenseCategory[],
): string {
  const code = resolveExpenseCategoryAccount(category, customCategories);
  return getAccount(code)?.name ?? 'Gider';
}
