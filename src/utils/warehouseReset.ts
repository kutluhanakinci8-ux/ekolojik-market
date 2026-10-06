import type { PersistedStoreSnapshot } from '../types/persistedStore';
import type { Product } from '../types/product';
import { applyIrsaliyeStockToProducts } from './applyIrsaliyeStock';

/** Tüm satış geçmişini sil; ürün stoklarını LUY irsaliyesine birebir yaz (açılış deposu). */
export function resetStoreToIrsaliyeWarehouse(
  snapshot: PersistedStoreSnapshot,
  catalogProducts: Product[],
): PersistedStoreSnapshot {
  const { products } = applyIrsaliyeStockToProducts(catalogProducts);

  return {
    ...snapshot,
    products,
    sales: [],
    saleReturns: [],
    stockMovements: [],
    cashSessions: [],
    cashHandovers: [],
    customerLedger: [],
    supplierLedger: snapshot.supplierLedger ?? [],
    journalVouchers: [],
    stockAdjustments: [],
    cashCountVariances: [],
    periodClosures: [],
    updatedAt: new Date().toISOString(),
    settings: {
      ...snapshot.settings,
    },
  };
}
