import type { PersistedStoreSnapshot } from '../types/persistedStore';
import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { posApiAuthHeaders, posApiFetch } from './posApiAuth';

function apiUrl(): string {
  const tenant = loadTenantId();
  const base = '/api/data';
  if (!tenant || tenant === DEFAULT_TENANT_ID) return base;
  return `${base}?tenant=${encodeURIComponent(tenant)}`;
}

export async function fetchStoreSnapshot(): Promise<PersistedStoreSnapshot | null> {
  try {
    const res = await posApiFetch(apiUrl(), {
      headers: posApiAuthHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as PersistedStoreSnapshot | Record<string, never>;
    if (!data || !data.updatedAt) return null;
    return data as PersistedStoreSnapshot;
  } catch {
    return null;
  }
}

export async function saveStoreSnapshot(snapshot: PersistedStoreSnapshot): Promise<boolean> {
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
