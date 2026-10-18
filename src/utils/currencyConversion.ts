import type {
  CurrencySettings,
  ExchangeRateQuote,
  ExchangeRateSide,
  SupportedCurrency,
} from '../types/currency';
import { CURRENCY_SYMBOLS, DEFAULT_CURRENCY_SETTINGS } from '../types/currency';

export function resolveRateSideQuote(
  quote: ExchangeRateQuote,
  side: ExchangeRateSide = 'sell',
): number {
  if (side === 'buy' && quote.buyRate) return quote.buyRate;
  if (side === 'sell' && quote.sellRate) return quote.sellRate;
  if (quote.buyRate && quote.sellRate) {
    return Math.round(((quote.buyRate + quote.sellRate) / 2) * 100000) / 100000;
  }
  return quote.rateToTry;
}

export function getRateToTry(
  currency: SupportedCurrency,
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS,
): number {
  if (currency === 'TRY') return 1;
  const quote = settings.rates[currency];
  if (!quote) return 0;
  return resolveRateSideQuote(quote, settings.rateSide);
}

export function convertToTry(
  amount: number,
  from: SupportedCurrency,
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS,
): number {
  if (!Number.isFinite(amount) || amount === 0) return 0;
  if (from === 'TRY') return Math.round(amount * 100) / 100;
  const rate = getRateToTry(from, settings);
  return Math.round(amount * rate * 100) / 100;
}

export function convertFromTry(
  amountTry: number,
  to: SupportedCurrency,
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS,
): number {
  if (!Number.isFinite(amountTry) || amountTry === 0) return 0;
  if (to === 'TRY') return Math.round(amountTry * 100) / 100;
  const rate = getRateToTry(to, settings);
  if (rate <= 0) return 0;
  return Math.round((amountTry / rate) * 100) / 100;
}

export function convertCurrency(
  amount: number,
  from: SupportedCurrency,
  to: SupportedCurrency,
  settings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS,
): number {
  return convertFromTry(convertToTry(amount, from, settings), to, settings);
}

export function formatMoney(
  amount: number,
  currency: SupportedCurrency = 'TRY',
): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const formatted = new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  if (currency === 'TRY') return `${formatted} ${symbol}`;
  return `${symbol}${formatted}`;
}

export function formatConversionHint(
  amount: number,
  from: SupportedCurrency,
  settings: CurrencySettings,
): string {
  if (from === 'TRY') return '';
  const tryAmount = convertToTry(amount, from, settings);
  const rate = getRateToTry(from, settings);
  return `${amount} ${from} × ${rate.toFixed(4)} = ${formatMoney(tryAmount, 'TRY')}`;
}
