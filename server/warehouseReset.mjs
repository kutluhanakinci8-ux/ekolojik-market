import { applyIrsaliyeStockToStoreSnapshot } from './irsaliyeStock.mjs';

export function resetStoreToIrsaliyeWarehouse(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    throw new Error('Geçersiz store');
  }
  const { snapshot: withStock } = applyIrsaliyeStockToStoreSnapshot(snapshot);
  const totalStock = (withStock.products ?? []).reduce((sum, p) => sum + (p.stock ?? 0), 0);

  return {
    ...withStock,
    sales: [],
    saleReturns: [],
    stockMovements: [],
    cashSessions: [],
    cashHandovers: [],
    customerLedger: [],
    journalVouchers: [],
    stockAdjustments: [],
    cashCountVariances: [],
    periodClosures: [],
    updatedAt: new Date().toISOString(),
  };
}
