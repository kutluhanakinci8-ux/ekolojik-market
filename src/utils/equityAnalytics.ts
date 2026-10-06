import type { CapitalContribution, EquityPartner } from '../types/accounting';
import { formatCurrency } from './format';

export interface PartnerCapitalRow {
  partnerId: string;
  partnerName: string;
  country: string;
  accountCode: string;
  sharePercent: number;
  totalContributed: number;
  contributionCount: number;
  lastContributionDate?: string;
}

export function buildPartnerCapitalRows(
  partners: EquityPartner[],
  contributions: CapitalContribution[],
): PartnerCapitalRow[] {
  return partners
    .filter((p) => p.isActive)
    .map((partner) => {
      const partnerContribs = contributions.filter((c) => c.partnerId === partner.id);
      const total = partnerContribs.reduce((sum, c) => sum + c.amountTry, 0);
      const last = partnerContribs[0]?.contributionDate;
      return {
        partnerId: partner.id,
        partnerName: partner.name,
        country: partner.country,
        accountCode: partner.accountCode,
        sharePercent: partner.sharePercent ?? 0,
        totalContributed: Math.round(total * 100) / 100,
        contributionCount: partnerContribs.length,
        lastContributionDate: last,
      };
    });
}

export function getTotalEquityCapital(contributions: CapitalContribution[]): number {
  return Math.round(contributions.reduce((sum, c) => sum + c.amountTry, 0) * 100) / 100;
}

export function formatPartnerCapitalSummary(rows: PartnerCapitalRow[]): string {
  const total = rows.reduce((sum, r) => sum + r.totalContributed, 0);
  return `Toplam sermaye: ${formatCurrency(total)} · ${rows.length} ortak`;
}
