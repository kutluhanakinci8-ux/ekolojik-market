import type { HeldPosSale } from '../types/pos';

const KEY = 'market-pos-held-sales';

export function loadHeldPosSales(): HeldPosSale[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HeldPosSale[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHeldPosSales(items: HeldPosSale[]): void {
  localStorage.setItem(KEY, JSON.stringify(items.slice(0, 20)));
}
