import { createContext, useContext, useMemo } from 'react';
import type { CurrencySettings, SupportedCurrency } from '../types/currency';
import { CURRENCY_SYMBOLS } from '../types/currency';
import { convertFromTry, formatMoney } from '../utils/currencyConversion';

export interface CurrencyDisplayValue {
  displayCurrency: SupportedCurrency;
  /** Tutarlar sistemde TL olarak saklanır; gösterimde seçilen para birimine çevrilir */
  formatDisplayCurrency: (amountTry: number) => string;
}

const defaultValue: CurrencyDisplayValue = {
  displayCurrency: 'TRY',
  formatDisplayCurrency: (amount) => formatMoney(amount, 'TRY'),
};

export const CurrencyDisplayContext = createContext<CurrencyDisplayValue>(defaultValue);

export function useCurrencyDisplay(): CurrencyDisplayValue {
  return useContext(CurrencyDisplayContext);
}

export function useCurrencyDisplayValue(settings: CurrencySettings): CurrencyDisplayValue {
  return useMemo(() => ({
    displayCurrency: settings.displayCurrency,
    formatDisplayCurrency: (amountTry: number) => {
      const converted = convertFromTry(amountTry, settings.displayCurrency, settings);
      return formatMoney(converted, settings.displayCurrency);
    },
  }), [settings]);
}

export function displayCurrencyLabel(currency: SupportedCurrency): string {
  return `${CURRENCY_SYMBOLS[currency]} ${currency}`;
}
