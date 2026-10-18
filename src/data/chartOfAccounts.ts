/** Tek Düzen Hesap Planı — ön muhasebe için sadeleştirilmiş hesaplar */

import type { EquityPartner } from '../types/accounting';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export interface ChartAccount {
  code: string;
  name: string;
  type: AccountType;
  /** Alt hesap / detay */
  parentCode?: string;
}

export const CHART_OF_ACCOUNTS: ChartAccount[] = [
  { code: '100', name: 'Kasa', type: 'asset' },
  { code: '101', name: 'Alınan Çekler ve Senetler', type: 'asset' },
  { code: '102', name: 'Bankalar', type: 'asset' },
  { code: '120', name: 'Alıcılar (Müşteri Cari)', type: 'asset' },
  { code: '153', name: 'Ticari Mallar', type: 'asset' },
  { code: '191', name: 'İndirilecek KDV', type: 'asset' },
  { code: '320', name: 'Satıcılar (Tedarikçi Cari)', type: 'liability' },
  { code: '391', name: 'Hesaplanan KDV', type: 'liability' },
  { code: '500', name: 'Ödenmiş Sermaye', type: 'equity' },
  { code: '502', name: 'Sermaye Düzeltme Olumlu Farkları', type: 'equity' },
  { code: '600', name: 'Yurtiçi Satışlar', type: 'revenue' },
  { code: '621', name: 'Satılan Ticari Mallar Maliyeti', type: 'expense' },
  { code: '760', name: 'Pazarlama Giderleri', type: 'expense' },
  { code: '770', name: 'Genel Yönetim Giderleri', type: 'expense' },
  { code: '770.01', name: 'Kira Giderleri', type: 'expense', parentCode: '770' },
  { code: '770.02', name: 'Elektrik / Su / Doğalgaz', type: 'expense', parentCode: '770' },
  { code: '770.03', name: 'Personel Giderleri', type: 'expense', parentCode: '770' },
  { code: '679', name: 'Diğer Olağandışı Gider ve Zararlar', type: 'expense' },
];

const accountMap = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export function getAccount(code: string): ChartAccount | undefined {
  return accountMap.get(code);
}

export function getAccountLabel(code: string): string {
  const acc = getAccount(code);
  return acc ? `${code} ${acc.name}` : code;
}

export function expenseCategoryAccount(category: string): string {
  switch (category) {
    case 'rent': return '770.01';
    case 'utilities': return '770.02';
    case 'salary': return '770.03';
    case 'supplies': return '760';
    default: return '770';
  }
}

export function paymentSourceAccount(source: 'cash' | 'bank' | 'check' | 'card'): string {
  switch (source) {
    case 'bank':
    case 'card':
      return '102';
    case 'check':
      return '101';
    default:
      return '100';
  }
}

/** Ortak alt hesaplarını hesap planına ekle (500.01 …) */
export function buildPartnerChartAccounts(partners: EquityPartner[]): ChartAccount[] {
  return partners
    .filter((p) => p.isActive)
    .map((p) => ({
      code: p.accountCode,
      name: p.isForeign ? `${p.name} (Yurtdışı Sermaye)` : `${p.name} Sermayesi`,
      type: 'equity' as AccountType,
      parentCode: '500',
    }));
}

export function getFullChartOfAccounts(partners: EquityPartner[] = []): ChartAccount[] {
  const partnerCodes = new Set(partners.map((p) => p.accountCode));
  const base = CHART_OF_ACCOUNTS.filter((a) => !partnerCodes.has(a.code));
  return [...base, ...buildPartnerChartAccounts(partners)];
}

export function partnerCapitalAccountCode(partner: EquityPartner): string {
  return partner.accountCode;
}
