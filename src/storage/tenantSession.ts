import { normalizeStoreCodeInput, validateStoreCodeForLogin } from '../config/knownTenants';
import { syncPosLocalStorageKeys } from './posLocalStorageKeys';

const TENANT_KEY = 'market-pos-tenant-id';

/** Varsayılan tenant — mevcut Greenleaf kullanıcıları */
export const DEFAULT_TENANT_ID = 'main';

export { normalizeStoreCodeInput } from '../config/knownTenants';

export function loadTenantId(): string {
  try {
    const raw = localStorage.getItem(TENANT_KEY);
    return normalizeStoreCodeInput(raw ?? DEFAULT_TENANT_ID);
  } catch {
    return DEFAULT_TENANT_ID;
  }
}

/**
 * /giris — URL'de ?tenant= yoksa her zaman Greenleaf (main).
 * Eski localStorage (ör. lima-market) kutluhan08 girişini bozmasın.
 */
export function resolveTenantIdForLoginPage(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID;
  const fromUrl = new URLSearchParams(window.location.search).get('tenant')?.trim();
  if (fromUrl) return normalizeStoreCodeInput(fromUrl);
  return DEFAULT_TENANT_ID;
}

export const TENANT_ID_CHANGED_EVENT = 'market-pos-tenant-id-changed';

export function saveTenantId(tenantId: string): void {
  try {
    const normalized = normalizeStoreCodeInput(tenantId);
    const validationError = validateStoreCodeForLogin(normalized);
    if (validationError) {
      console.warn('[tenant]', validationError);
      return;
    }
    localStorage.setItem(TENANT_KEY, normalized);
    syncPosLocalStorageKeys(normalized);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(TENANT_ID_CHANGED_EVENT, { detail: { tenantId: normalized } }));
    }
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
