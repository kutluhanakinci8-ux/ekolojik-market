import type { PersistedStoreSnapshot } from '../types/persistedStore';
import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';
import { mergeStoreSnapshots } from '../utils/mergeStoreSnapshots';
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
  return remote ? mergeStoreSnapshots(local, remote) : local;
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
  return mergeStoreSnapshots(local, remote);
}
