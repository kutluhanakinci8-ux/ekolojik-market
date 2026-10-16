import type { CurrencySettings, SupportedCurrency } from '../types/currency';
import { loadTenantId } from './tenantSession';

const KEY_PREFIX = 'market-pos-display-currency';

function storageKey(tenantId?: string): string {
  const tenant = (tenantId ?? loadTenantId() ?? 'main').trim() || 'main';
  return `${KEY_PREFIX}:${tenant}`;
}

/** Kullanıcının panelde seçtiği görünüm para birimi (tarayıcı / kiracı). Yoksa varsayılan TL. */
export function loadDisplayCurrencyPreference(tenantId?: string): SupportedCurrency {
  try {
    const raw = localStorage.getItem(storageKey(tenantId))?.trim().toUpperCase();
    if (raw === 'TRY' || raw === 'USD' || raw === 'KZT') return raw;
  } catch {
    /* ignore */
  }
  return 'TRY';
}

export function saveDisplayCurrencyPreference(
  currency: SupportedCurrency,
  tenantId?: string,
): void {
  try {
    localStorage.setItem(storageKey(tenantId), currency);
  } catch {
    /* ignore */
  }
}

/** Sunucu/seed USD kaydı görünümü ezmesin — varsayılan ₺, kullanıcı seçimi tarayıcıda kalır */
export function applyDisplayCurrencyPreference(currency: CurrencySettings): CurrencySettings {
  return {
    ...currency,
    displayCurrency: loadDisplayCurrencyPreference(),
  };
}
