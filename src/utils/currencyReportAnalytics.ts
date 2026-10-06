import type { CurrencyRateHistoryPoint, CurrencySettings } from '../types/currency';
import { CURRENCY_LABELS } from '../types/currency';
import { formatReportDateLabel } from './analytics';

export interface CurrencyRateSummaryRow {
  code: 'USD' | 'KZT';
  label: string;
  rateToTry: number;
  buyRate?: number;
  sellRate?: number;
  source: string;
  updatedAt: string;
  isManualOverride: boolean;
}

export interface CurrencyChangeRow {
  currency: 'USD' | 'KZT';
  label: string;
  currentRate: number;
  pastRate: number | null;
  changePercent: number | null;
  changeAbsolute: number | null;
}

export interface CurrencyTrendPoint {
  date: string;
  dateLabel: string;
  rate: number;
}

export interface CurrencyReportDashboard {
  displayCurrency: string;
  autoSource: string;
  rateSide: string;
  lastAutoFetchAt?: string;
  rates: CurrencyRateSummaryRow[];
  weekChange: CurrencyChangeRow[];
  monthChange: CurrencyChangeRow[];
  weekTrendByCurrency: Record<'USD' | 'KZT', CurrencyTrendPoint[]>;
  monthTrendByCurrency: Record<'USD' | 'KZT', CurrencyTrendPoint[]>;
}

const FOREIGN: Array<'USD' | 'KZT'> = ['USD', 'KZT'];

export function formatRateSource(source: string): string {
  if (source === 'tcmb') return 'TCMB';
  if (source === 'vakifbank') return 'VakıfBank';
  return 'Manuel';
}

function bootstrapHistory(settings: CurrencySettings): CurrencyRateHistoryPoint[] {
  const existing = settings.rateHistory ?? [];
  if (existing.length > 0) return existing;
  return FOREIGN.map((code) => ({
    currency: code,
    rateToTry: settings.rates[code].rateToTry,
    recordedAt: settings.rates[code].updatedAt,
  }));
}

function rateAtOrBefore(
  history: CurrencyRateHistoryPoint[],
  currency: 'USD' | 'KZT',
  targetIso: string,
): number | null {
  const targetMs = new Date(targetIso).getTime();
  const points = history
    .filter((point) => point.currency === currency)
    .filter((point) => new Date(point.recordedAt).getTime() <= targetMs)
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
  return points.length > 0 ? points[points.length - 1].rateToTry : null;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildDailyTrend(
  history: CurrencyRateHistoryPoint[],
  currency: 'USD' | 'KZT',
  dayCount: number,
  currentRate: number,
): CurrencyTrendPoint[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const points: CurrencyTrendPoint[] = [];
  let lastKnown = currentRate;

  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const day = addDays(today, -offset);
    const key = dayKey(day);
    const endOfDay = `${key}T23:59:59.999`;
    const rate = rateAtOrBefore(history, currency, endOfDay);
    if (rate != null) lastKnown = rate;
    points.push({
      date: key,
      dateLabel: formatReportDateLabel(key),
      rate: rate ?? lastKnown,
    });
  }

  return points;
}

function buildChangeRow(
  currency: 'USD' | 'KZT',
  currentRate: number,
  pastRate: number | null,
): CurrencyChangeRow {
  const changeAbsolute = pastRate != null ? currentRate - pastRate : null;
  const changePercent = pastRate != null && pastRate > 0
    ? ((currentRate - pastRate) / pastRate) * 100
    : null;
  return {
    currency,
    label: CURRENCY_LABELS[currency],
    currentRate,
    pastRate,
    changePercent,
    changeAbsolute,
  };
}

export function buildCurrencyReportDashboard(settings: CurrencySettings): CurrencyReportDashboard {
  const history = bootstrapHistory(settings);
  const now = new Date();
  const weekAgo = addDays(now, -7).toISOString();
  const monthAgo = addDays(now, -30).toISOString();

  const rates: CurrencyRateSummaryRow[] = FOREIGN.map((code) => {
    const quote = settings.rates[code];
    return {
      code,
      label: CURRENCY_LABELS[code],
      rateToTry: quote.rateToTry,
      buyRate: quote.buyRate,
      sellRate: quote.sellRate,
      source: formatRateSource(quote.source),
      updatedAt: quote.updatedAt,
      isManualOverride: Boolean(quote.isManualOverride),
    };
  });

  const weekChange = FOREIGN.map((code) => {
    const current = settings.rates[code].rateToTry;
    const past = rateAtOrBefore(history, code, weekAgo);
    return buildChangeRow(code, current, past);
  });

  const monthChange = FOREIGN.map((code) => {
    const current = settings.rates[code].rateToTry;
    const past = rateAtOrBefore(history, code, monthAgo);
    return buildChangeRow(code, current, past);
  });

  const weekTrendByCurrency = {
    USD: buildDailyTrend(history, 'USD', 7, settings.rates.USD.rateToTry),
    KZT: buildDailyTrend(history, 'KZT', 7, settings.rates.KZT.rateToTry),
  };

  const monthTrendByCurrency = {
    USD: buildDailyTrend(history, 'USD', 30, settings.rates.USD.rateToTry),
    KZT: buildDailyTrend(history, 'KZT', 30, settings.rates.KZT.rateToTry),
  };

  return {
    displayCurrency: settings.displayCurrency,
    autoSource: settings.autoSource === 'tcmb' ? 'TCMB (otomatik)' : 'Manuel',
    rateSide: settings.rateSide === 'buy' ? 'Alış' : settings.rateSide === 'sell' ? 'Satış' : 'Orta',
    lastAutoFetchAt: settings.lastAutoFetchAt,
    rates,
    weekChange,
    monthChange,
    weekTrendByCurrency,
    monthTrendByCurrency,
  };
}
