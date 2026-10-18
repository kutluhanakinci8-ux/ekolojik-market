/**
 * Kurumsal POS modeli (Square / Shopify POS / Lightspeed benzeri):
 * Oturum açıkken mağaza verisi sunucuda tutulur; tarayıcı önbelleği sunucu ile birleştirilir.
 * «Yalnızca bu cihaz» fork’u yok — çoklu kasa/ekran tek gerçek kaynağı paylaşır.
 */
import type { PersistedStoreSnapshot } from '../types/persistedStore';
import { mergeStoreSnapshots } from './mergeStoreSnapshots';
import {
  applySalesHistoryClearToSnapshot,
  shouldForceServerSalesSnapshot,
} from './salesHistoryClear';
import { posLocalStorageKeys } from '../storage/posLocalStorageKeys';

export function mergeServerAuthoritativeSnapshot(
  local: PersistedStoreSnapshot,
  remote: PersistedStoreSnapshot,
): PersistedStoreSnapshot {
  if (shouldForceServerSalesSnapshot(local, remote)) {
    return applySalesHistoryClearToSnapshot(remote, remote.settings?.salesHistoryClearedAt);
  }
  return mergeStoreSnapshots(local, remote);
}

/** Sunucu eşitlemesi öncesi yerel satış/kasa kopyasını diskten sil (React state ayrı güncellenir). */
export function wipeOperationalLocalStorageOnDisk(): void {
  const keys = posLocalStorageKeys();
  for (const id of [
    'sales',
    'saleReturns',
    'stockMovements',
    'cashHandovers',
    'cashSessions',
  ] as const) {
    try {
      localStorage.removeItem(keys[id]);
    } catch {
      /* ignore */
    }
  }
}
