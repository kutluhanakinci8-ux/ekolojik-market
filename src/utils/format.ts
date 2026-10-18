import type { CurrencySettings } from '../types/currency';
import { DEFAULT_CURRENCY_SETTINGS } from '../types/currency';
import { convertFromTry, formatMoney } from './currencyConversion';

let displaySettings: CurrencySettings = DEFAULT_CURRENCY_SETTINGS;

/** App açılışında ve döviz ayarı değişince çağrılır — tüm formatCurrency() bu kurları kullanır */
export function setCurrencyDisplaySettings(settings: CurrencySettings): void {
  displaySettings = settings;
}

/** Sistemdeki TL tutarını seçili görünüm para birimine çevirip formatlar */
export function formatCurrency(amountTry: number): string {
  const display = displaySettings.displayCurrency;
  const converted = convertFromTry(amountTry, display, displaySettings);
  return formatMoney(converted, display);
}

/** Kayıt / muhasebe defteri için sabit TL formatı */
export function formatCurrencyTry(amountTry: number): string {
  return formatMoney(amountTry, 'TRY');
}

/** Üst bar, giriş ekranı ve boş sepet görünümü için işletme adı */
export function formatBusinessBrand(businessName: string | undefined | null): string {
  const trimmed = businessName?.trim();
  return trimmed || 'Mağaza';
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
