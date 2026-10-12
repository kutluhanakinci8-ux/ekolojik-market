import type { PersistedStoreSnapshot } from '../types/persistedStore';
import type { Sale } from '../types/product';
import type { SaleReturn } from '../types/saleReturn';
import type { StockMovement } from '../types/product';

function clearTs(iso: string | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

export function resolveSalesHistoryClearedAt(
  ...snapshots: Array<PersistedStoreSnapshot | null | undefined>
): string | undefined {
  let best = 0;
  let value: string | undefined;
  for (const snap of snapshots) {
    const at = snap?.settings?.salesHistoryClearedAt;
    const t = clearTs(at);
    if (t > best) {
      best = t;
      value = at;
    }
  }
  return value;
}

export function filterSalesAfterHistoryClear(sales: Sale[], clearedAt: string | undefined): Sale[] {
  const t0 = clearTs(clearedAt);
  if (!t0) return sales;
  return sales.filter((s) => clearTs(s.createdAt) > t0);
}

export function filterReturnsAfterHistoryClear(returns: SaleReturn[], clearedAt: string | undefined): SaleReturn[] {
  const t0 = clearTs(clearedAt);
  if (!t0) return returns;
  return returns.filter((s) => clearTs(s.createdAt) > t0);
}

export function filterMovementsAfterHistoryClear(
  movements: StockMovement[],
  clearedAt: string | undefined,
): StockMovement[] {
  const t0 = clearTs(clearedAt);
  if (!t0) return movements;
  return movements.filter((m) => clearTs(m.createdAt) > t0);
}

/** Sunucu satış sıfırlaması — eski yerel kayıtları birleştirmeye dahil etme */
export function applySalesHistoryClearToSnapshot(
  snapshot: PersistedStoreSnapshot,
  clearedAt: string | undefined,
): PersistedStoreSnapshot {
  if (!clearedAt) return snapshot;
  return {
    ...snapshot,
    sales: filterSalesAfterHistoryClear(snapshot.sales ?? [], clearedAt),
    saleReturns: filterReturnsAfterHistoryClear(snapshot.saleReturns ?? [], clearedAt),
    stockMovements: filterMovementsAfterHistoryClear(snapshot.stockMovements ?? [], clearedAt),
    customerLedger: clearTs(clearedAt) ? [] : snapshot.customerLedger,
  };
}

export function localSnapshotHasStaleSales(
  sales: Sale[],
  clearedAt: string | undefined,
): boolean {
  const t0 = clearTs(clearedAt);
  if (!t0 || !sales.length) return false;
  return sales.some((s) => clearTs(s.createdAt) <= t0);
}
