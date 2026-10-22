import type { PersistedStoreSnapshot } from '../types/persistedStore';
import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { reconcileSaleStockInSnapshot } from '../utils/reconcileSaleStockMovements';
import { mergeServerAuthoritativeSnapshot } from '../utils/serverAuthoritativeSync';
import { loadPosApiToken, posApiAuthHeaders, posApiFetch } from './posApiAuth';

function apiUrl(): string {
  const tenant = loadTenantId();
  const base = '/api/data';
  if (!tenant || tenant === DEFAULT_TENANT_ID) return base;
  return `${base}?tenant=${encodeURIComponent(tenant)}`;
}

export type StoreSnapshotFetchError =
  | 'no_token'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'invalid_payload'
  | 'network';

export async function fetchStoreSnapshotWithDiagnostics(): Promise<{
  snapshot: PersistedStoreSnapshot | null;
  error?: StoreSnapshotFetchError;
  httpStatus?: number;
}> {
  if (!loadPosApiToken()) {
    return { snapshot: null, error: 'no_token' };
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const res = await posApiFetch(apiUrl(), {
        headers: posApiAuthHeaders(),
        signal: AbortSignal.timeout(12_000),
      });
      if (res.status === 401) {
        return { snapshot: null, error: 'unauthorized', httpStatus: 401 };
      }
      if (res.status === 403) {
        return { snapshot: null, error: 'forbidden', httpStatus: 403 };
      }
      if (res.status === 404) {
        return { snapshot: null, error: 'not_found', httpStatus: 404 };
      }
      if (!res.ok) {
        return { snapshot: null, error: 'network', httpStatus: res.status };
      }
      const data = (await res.json()) as PersistedStoreSnapshot | Record<string, never>;
      if (!data || !data.updatedAt) {
        return { snapshot: null, error: 'invalid_payload', httpStatus: res.status };
      }
      return { snapshot: data as PersistedStoreSnapshot };
    } catch {
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }
  return { snapshot: null, error: 'network' };
}

export async function fetchStoreSnapshot(): Promise<PersistedStoreSnapshot | null> {
  const result = await fetchStoreSnapshotWithDiagnostics();
  return result.snapshot;
}

export async function putStoreSnapshot(snapshot: PersistedStoreSnapshot): Promise<boolean> {
  try {
    const res = await posApiFetch(apiUrl(), {
      method: 'PUT',
      headers: posApiAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(snapshot),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function buildMergedSnapshotForSave(
  local: PersistedStoreSnapshot,
): Promise<PersistedStoreSnapshot> {
  const remote = await fetchStoreSnapshot();
  const merged = remote ? mergeServerAuthoritativeSnapshot(local, remote) : local;
  const { snapshot } = reconcileSaleStockInSnapshot(merged);
  return snapshot;
}

export async function saveStoreSnapshot(snapshot: PersistedStoreSnapshot): Promise<boolean> {
  const payload = await buildMergedSnapshotForSave(snapshot);
  return putStoreSnapshot(payload);
}

/** Uzak veriyi yerel ile birleştir (çekme / sekme senkronu). */
export async function fetchMergedWithLocal(
  local: PersistedStoreSnapshot,
): Promise<PersistedStoreSnapshot | null> {
  const remote = await fetchStoreSnapshot();
  if (!remote) return null;
  return mergeServerAuthoritativeSnapshot(local, remote);
}
