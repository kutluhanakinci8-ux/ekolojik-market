import type { CurrencySettings, ExchangeRateQuote } from '../types/currency';
import { DEFAULT_CURRENCY_SETTINGS } from '../types/currency';
import { resolveRateSideQuote } from '../utils/currencyConversion';

export interface TcmbRateRow {
  code: string;
  unit: number;
  name: string;
  buyRate: number;
  sellRate: number;
}

export interface TcmbRatesResponse {
  fetchedAt: string;
  bulletinDate?: string;
  rates: TcmbRateRow[];
}

const FOREIGN_CURRENCIES = ['USD', 'KZT'] as const;
const MAX_RATE_HISTORY_POINTS = 800;

export function appendCurrencyRateHistory(settings: CurrencySettings): CurrencySettings {
  const now = new Date().toISOString();
  const history = [...(settings.rateHistory ?? [])];

  for (const code of FOREIGN_CURRENCIES) {
    const rateToTry = settings.rates[code].rateToTry;
    const lastForCurrency = [...history]
      .reverse()
      .find((point) => point.currency === code);
    const sameDay = lastForCurrency?.recordedAt.slice(0, 10) === now.slice(0, 10);
    const unchanged = lastForCurrency
      && Math.abs(lastForCurrency.rateToTry - rateToTry) < 0.000_05;
    if (sameDay && unchanged) continue;

    history.push({
      currency: code,
      rateToTry,
      recordedAt: now,
    });
  }

  const trimmed = history
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .slice(-MAX_RATE_HISTORY_POINTS);

  return { ...settings, rateHistory: trimmed };
}

function applyQuoteFromRow(
  row: TcmbRateRow,
  source: ExchangeRateQuote['source'],
): ExchangeRateQuote {
  const unit = row.unit > 0 ? row.unit : 1;
  const buyRate = row.buyRate / unit;
  const sellRate = row.sellRate / unit;
  const quote: ExchangeRateQuote = {
    currency: row.code as ExchangeRateQuote['currency'],
    buyRate,
    sellRate,
    rateToTry: sellRate,
    source,
    updatedAt: new Date().toISOString(),
    isManualOverride: false,
  };
  return quote;
}

export function mergeTcmbIntoSettings(
  current: CurrencySettings,
  tcmb: TcmbRatesResponse,
): CurrencySettings {
  const next: CurrencySettings = {
    ...current,
    lastAutoFetchAt: tcmb.fetchedAt,
    rates: { ...current.rates },
  };

  for (const code of FOREIGN_CURRENCIES) {
    const existing = current.rates[code];
    if (existing?.isManualOverride) continue;
    const row = tcmb.rates.find((item) => item.code === code);
    if (!row || row.sellRate <= 0) continue;
    next.rates[code] = applyQuoteFromRow(row, 'tcmb');
    next.rates[code].rateToTry = resolveRateSideQuote(next.rates[code], current.rateSide);
  }

  return appendCurrencyRateHistory(next);
}

export async function fetchTcmbRates(): Promise<TcmbRatesResponse> {
  const response = await fetch('/api/exchange-rates/tcmb');
  if (!response.ok) {
    throw new Error('TCMB kurları alınamadı');
  }
  return response.json() as Promise<TcmbRatesResponse>;
}

export function updateManualRate(
  settings: CurrencySettings,
  currency: ExchangeRateQuote['currency'],
  rateToTry: number,
): CurrencySettings {
  const prev = settings.rates[currency] ?? DEFAULT_CURRENCY_SETTINGS.rates[currency];
  const next: CurrencySettings = {
    ...settings,
    rates: {
      ...settings.rates,
      [currency]: {
        ...prev,
        currency,
        rateToTry,
        buyRate: rateToTry,
        sellRate: rateToTry,
        source: 'manual',
        isManualOverride: true,
        updatedAt: new Date().toISOString(),
      },
    },
  };
  return appendCurrencyRateHistory(next);
}

export function clearManualOverride(
  settings: CurrencySettings,
  currency: ExchangeRateQuote['currency'],
): CurrencySettings {
  const prev = settings.rates[currency];
  if (!prev) return settings;
  return {
    ...settings,
    rates: {
      ...settings.rates,
      [currency]: {
        ...prev,
        isManualOverride: false,
      },
    },
  };
}
