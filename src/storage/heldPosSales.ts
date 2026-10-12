import type { HeldPosSale } from '../types/pos';
import { tenantLocalStorageSuffix } from './posLocalStorageKeys';

function storageKey(): string {
  return `market-pos-held-sales${tenantLocalStorageSuffix()}`;
}

export function loadHeldPosSales(): HeldPosSale[] {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HeldPosSale[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHeldPosSales(items: HeldPosSale[]): void {
  localStorage.setItem(storageKey(), JSON.stringify(items.slice(0, 20)));
}
