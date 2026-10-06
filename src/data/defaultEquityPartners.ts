import type { EquityPartner } from '../types/accounting';

/** 5 yurtdışı ortak için varsayılan hesap kodları (500.01 – 500.05) */
export const PARTNER_ACCOUNT_CODES = ['500.01', '500.02', '500.03', '500.04', '500.05'] as const;

export function createDefaultEquityPartners(): EquityPartner[] {
  const now = new Date().toISOString();
  return PARTNER_ACCOUNT_CODES.map((code, index) => ({
    id: `EP-${index + 1}`,
    name: `Yurtdışı Ortak ${index + 1}`,
    country: '',
    accountCode: code,
    sharePercent: 20,
    isForeign: true,
    isActive: true,
    createdAt: now,
  }));
}
