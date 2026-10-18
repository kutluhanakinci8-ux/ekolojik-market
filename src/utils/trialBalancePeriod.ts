import type { ReportPeriod } from './analytics';

function periodRangeEnd(period: ReportPeriod): Date {
  const end = new Date();
  if (period === 'today') end.setHours(23, 59, 59, 999);
  return end;
}

/** YYYY-MM-DD veya tam ISO; geçersizse undefined */
function parseBusinessDateKey(dateKey: string | undefined): Date | undefined {
  if (!dateKey?.trim()) return undefined;
  const trimmed = dateKey.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export function matchesReportPeriod(
  businessDateKey: string | undefined,
  createdAt: string,
  period: ReportPeriod,
): boolean {
  if (period === 'all') return true;

  const now = new Date();
  const start = new Date(now);
  if (period === 'today') start.setHours(0, 0, 0, 0);
  else if (period === 'week') start.setDate(now.getDate() - 7);
  else if (period === 'month') start.setMonth(now.getMonth() - 1);

  const end = periodRangeEnd(period);
  const candidates: Date[] = [];
  const business = parseBusinessDateKey(businessDateKey);
  if (business) candidates.push(business);
  const created = new Date(createdAt);
  if (!Number.isNaN(created.getTime())) candidates.push(created);

  return candidates.some((candidate) => candidate >= start && candidate <= end);
}
