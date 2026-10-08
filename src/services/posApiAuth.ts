import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';

const TOKEN_KEY = 'market-pos-api-token';

function tenantQuery(): string {
  const tenant = loadTenantId();
  if (!tenant || tenant === DEFAULT_TENANT_ID) return '';
  return `?tenant=${encodeURIComponent(tenant)}`;
}

export function loadPosApiToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    return raw?.trim() || null;
  } catch {
    return null;
  }
}

export function savePosApiToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearPosApiToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}

export function posApiAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  const token = loadPosApiToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function exchangePosApiToken(credentials: {
  username: string;
  password?: string;
  pin?: string;
}): Promise<{ ok: boolean; token?: string; error?: string }> {
  try {
    const res = await fetch(`/api/auth/pos-token${tenantQuery()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(credentials),
    });
    const data = (await res.json()) as { ok?: boolean; token?: string; message?: string };
    if (!res.ok || !data.ok || !data.token) {
      return { ok: false, error: data.message ?? 'API token alınamadı' };
    }
    savePosApiToken(data.token);
    return { ok: true, token: data.token };
  } catch {
    return { ok: false, error: 'API token isteği başarısız' };
  }
}
