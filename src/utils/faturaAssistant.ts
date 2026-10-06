import type { PaymentScope } from '../types/paymentReminder';
import type { UtilityBillSubscription } from '../types/utilityBillSubscription';

export const FATURA_ASAT_URL =
  'https://www.faturaodemelisin.com/antalya-su-asat-faturasi-odeme-sorgulama';

export interface FaturaAssistantDebtRow {
  dueDate: string;
  installment?: string;
  amount?: string;
  delayAmount?: string;
  totalAmount?: string;
  description?: string;
}

export interface FaturaAssistantResult {
  type: 'fatura-assistant-complete';
  ok: boolean;
  contract: string;
  subscriptionId: string;
  scope?: PaymentScope;
  message?: string;
  noDebt?: boolean;
  debts?: FaturaAssistantDebtRow[];
}

function parseTurkishDate(raw: string): string | null {
  const match = raw.trim().match(/(\d{2})[./-](\d{2})[./-](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function parseTurkishAmount(raw?: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : 0;
}

export function parseFaturaAssistantResult(result: FaturaAssistantResult) {
  if (!result.ok) {
    if (result.noDebt) {
      return {
        ok: true,
        balance: 0,
        noDebt: true,
        message: result.message || 'Borç bulunamadı',
      };
    }
    return {
      ok: false,
      message: result.message || 'ASAT sorgusu sonuç vermedi',
    };
  }

  const debts = result.debts ?? [];
  if (!debts.length) {
    return { ok: false, message: 'Borç kaydı bulunamadı' };
  }

  const earliest = debts.reduce((best, item) => {
    const dueDate = parseTurkishDate(item.dueDate);
    if (!dueDate) return best;
    if (!best?.dueDate || dueDate < best.dueDate) {
      return { dueDate, balance: parseTurkishAmount(item.totalAmount || item.amount) };
    }
    return best;
  }, null as { dueDate: string; balance: number } | null);

  const totalBalance = debts.reduce(
    (sum, item) => sum + parseTurkishAmount(item.totalAmount || item.amount),
    0,
  );

  const balance = totalBalance > 0 ? totalBalance : (earliest?.balance ?? 0);
  const dueDate = earliest?.dueDate;

  if (balance <= 0 && !dueDate) {
    return {
      ok: true,
      balance: 0,
      noDebt: true,
      message: 'Borç bulunamadı',
    };
  }

  return {
    ok: true,
    balance,
    dueDate,
    message: 'ASAT borcu takvime aktarıldı',
  };
}

export function isFaturaAssistantCompleteMessage(data: unknown): data is FaturaAssistantResult {
  return Boolean(
    data
    && typeof data === 'object'
    && (data as FaturaAssistantResult).type === 'fatura-assistant-complete',
  );
}

export function buildFaturaContractMessage(subscription: UtilityBillSubscription) {
  return {
    type: 'market-pos-fatura-set-contract',
    contract: subscription.contractNumber,
    subscriptionId: subscription.id,
    scope: subscription.scope,
    label: subscription.label,
  };
}
