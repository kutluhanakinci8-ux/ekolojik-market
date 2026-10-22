import { tenantLocalStorageSuffix } from './posLocalStorageKeys';
import type { StockCountBreakRecord } from '../types/stockCountReport';

export type StockCountLineDraft = {
  productId: number;
  systemStock: number;
  scannedQty: number;
};

export type StockCountSessionDraft = {
  version: 1;
  savedAt: string;
  startedAt: string;
  countPhase: 'scan' | 'report' | 'apply';
  countLines: Record<number, StockCountLineDraft>;
  countLastProductId: number | null;
  note: string;
  reportId: string | null;
  countedByDisplayName?: string;
  countedByUsername?: string;
  breaks?: StockCountBreakRecord[];
  responsiblePersonName?: string;
  endedAt?: string;
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

export function saveStockCountSessionDraft(
  draft: Omit<StockCountSessionDraft, 'version' | 'savedAt'>,
): void {
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

/** Modal kapanırken okutma fazında ara verme kaydı */
export function appendStockCountPauseToDraft(): void {
  const draft = loadStockCountSessionDraft();
  if (!draft || Object.keys(draft.countLines).length === 0) return;
  if (draft.countPhase !== 'scan') return;
  const breaks = [...(draft.breaks ?? [])];
  const last = breaks[breaks.length - 1];
  if (last && !last.resumedAt) return;
  breaks.push({ pausedAt: new Date().toISOString() });
  saveStockCountSessionDraft({ ...draft, breaks });
}

/** Modal tekrar açıldığında son arayı kapat */
export function resumeStockCountPauseInDraft(): StockCountBreakRecord[] {
  const draft = loadStockCountSessionDraft();
  if (!draft?.breaks?.length) return draft?.breaks ?? [];
  const breaks = [...draft.breaks];
  const last = breaks[breaks.length - 1];
  if (last && !last.resumedAt) {
    breaks[breaks.length - 1] = { ...last, resumedAt: new Date().toISOString() };
    saveStockCountSessionDraft({ ...draft, breaks });
  }
  return breaks;
}
