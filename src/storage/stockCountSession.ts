import { tenantLocalStorageSuffix } from './posLocalStorageKeys';

export type StockCountLineDraft = {
  productId: number;
  systemStock: number;
  scannedQty: number;
};

export type StockCountSessionDraft = {
  version: 1;
  savedAt: string;
  startedAt: string;
  countPhase: 'scan' | 'report';
  countLines: Record<number, StockCountLineDraft>;
  countLastProductId: number | null;
  note: string;
};

function storageKey(): string {
  return `market-pos-stock-count-draft${tenantLocalStorageSuffix()}`;
}

export function loadStockCountSessionDraft(): StockCountSessionDraft | null {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StockCountSessionDraft;
    if (parsed?.version !== 1 || !parsed.countLines) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStockCountSessionDraft(draft: Omit<StockCountSessionDraft, 'version' | 'savedAt'>): void {
  try {
    const payload: StockCountSessionDraft = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...draft,
    };
    localStorage.setItem(storageKey(), JSON.stringify(payload));
  } catch {
    /* ignore quota */
  }
}

export function clearStockCountSessionDraft(): void {
  try {
    localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
}

export function countDraftLineTotal(draft: StockCountSessionDraft | null): number {
  if (!draft) return 0;
  return Object.values(draft.countLines).reduce((sum, line) => sum + line.scannedQty, 0);
}
