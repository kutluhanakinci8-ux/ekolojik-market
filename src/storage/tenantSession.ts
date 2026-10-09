import { syncPosLocalStorageKeys } from './posLocalStorageKeys';

const TENANT_KEY = 'market-pos-tenant-id';

/** Varsayılan tenant — mevcut Greenleaf kullanıcıları */
export const DEFAULT_TENANT_ID = 'main';

export function loadTenantId(): string {
  try {
    return localStorage.getItem(TENANT_KEY) || DEFAULT_TENANT_ID;
  } catch {
    return DEFAULT_TENANT_ID;
  }
}

export function saveTenantId(tenantId: string): void {
  try {
    localStorage.setItem(TENANT_KEY, tenantId);
    syncPosLocalStorageKeys(tenantId);
  } catch {
    /* ignore */
  }
}

export function clearTenantId(): void {
  try {
    localStorage.removeItem(TENANT_KEY);
  } catch {
    /* ignore */
  }
}
