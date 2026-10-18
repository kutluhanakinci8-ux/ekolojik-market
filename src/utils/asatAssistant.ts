import type { PaymentScope } from '../types/paymentReminder';
import type { UtilityBillSubscription } from '../types/utilityBillSubscription';

export const ASAT_LOGIN_URL = 'https://online.asat.gov.tr/loginAnonym';
export const ASAT_DEBTS_URL = 'https://online.asat.gov.tr/odenmemisBorclar';
export const ASAT_PROXY_LOGIN_URL = '/asat-proxy/loginAnonym';
export const ASAT_PROXY_DEBTS_URL = '/asat-proxy/odenmemisBorclar';

export interface AsatAssistantDebtRow {
  dueDate: string;
  installment?: string;
  amount?: string;
  delayAmount?: string;
  totalAmount?: string;
  description?: string;
}

export interface AsatAssistantResult {
  type: 'asat-assistant-complete';
  ok: boolean;
  contract: string;
  subscriptionId: string;
  scope?: PaymentScope;
  message?: string;
  noDebt?: boolean;
  debts?: AsatAssistantDebtRow[];
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

export function parseAsatAssistantResult(result: AsatAssistantResult) {
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
  if (!debts.length || result.noDebt) {
    return {
      ok: true,
      balance: 0,
      noDebt: true,
      message: result.message || 'Borç bulunamadı',
    };
  }

  const earliest = debts.reduce((best, item) => {
    const dueDate = parseTurkishDate(item.dueDate);
    const balance = parseTurkishAmount(item.totalAmount || item.amount);
    if (!dueDate) return best;
    if (!best?.dueDate || dueDate < best.dueDate) {
      return { dueDate, balance };
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

export function buildAsatSyncMessage(subscription: UtilityBillSubscription) {
  return {
    type: 'market-pos-asat-sync',
    contract: subscription.contractNumber,
    subscriptionId: subscription.id,
    scope: subscription.scope,
    label: subscription.label,
  };
}

export function buildAsatSyncAllMessage(subscriptions: UtilityBillSubscription[]) {
  return {
    type: 'market-pos-asat-sync-all',
    contracts: subscriptions.map((item) => ({
      contract: item.contractNumber,
      subscriptionId: item.id,
      scope: item.scope,
      label: item.label,
    })),
  };
}

export function isAsatAssistantCompleteMessage(data: unknown): data is AsatAssistantResult {
  return Boolean(
    data
    && typeof data === 'object'
    && (data as AsatAssistantResult).type === 'asat-assistant-complete',
  );
}
