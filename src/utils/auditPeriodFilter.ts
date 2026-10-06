import type { ReportPeriod } from './analytics';
import { filterAccountingByPeriod } from './accountingAnalytics';

export function filterAuditByPeriod<T extends { createdAt: string }>(
  items: T[],
  period: ReportPeriod,
): T[] {
  return filterAccountingByPeriod(items, period, false, '', '');
}
