import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';

const TOKEN_KEY = 'market-pos-api-token';
const TOKEN_VERSION = 'v1';
/** Sunucu TTL 24h — bitime 4h kala yenile */
const REFRESH_WITHIN_MS = 4 * 60 * 60 * 1000;
const SCHEDULER_MS = 5 * 60 * 1000;

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshInFlight: Promise<{ ok: boolean; error?: string }> | null = null;

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

export type PosApiTokenClaims = {
  tenantId?: string;
  userId?: string;
  role?: string;
  exp?: number;
};

export function decodePosApiTokenClaims(token: string | null): PosApiTokenClaims | null {
  if (!token?.trim()) return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return null;
  try {
    const bin = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as PosApiTokenClaims;
  } catch {
    return null;
  }
}

export function posApiTokenNeedsRefresh(token: string | null, withinMs = REFRESH_WITHIN_MS): boolean {
  const claims = decodePosApiTokenClaims(token);
  if (!claims?.exp) return Boolean(token);
  return claims.exp - Date.now() < withinMs;
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

export async function refreshPosApiToken(): Promise<{ ok: boolean; token?: string; error?: string }> {
  const current = loadPosApiToken();
  if (!current) return { ok: false, error: 'Oturum token yok' };

  if (refreshInFlight) {
    const shared = await refreshInFlight;
    return shared.ok
      ? { ok: true, token: loadPosApiToken() ?? undefined }
      : { ok: false, error: shared.error ?? 'Yenileme başarısız' };
  }

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`/api/auth/pos-token/refresh${tenantQuery()}`, {
        method: 'POST',
        headers: posApiAuthHeaders(),
      });
      const data = (await res.json()) as { ok?: boolean; token?: string; message?: string };
      if (!res.ok || !data.ok || !data.token) {
        return { ok: false, error: data.message ?? 'Token yenilenemedi' };
      }
      savePosApiToken(data.token);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Token yenileme isteği başarısız' };
    }
  })();

  try {
    const result = await refreshInFlight;
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, token: loadPosApiToken() ?? undefined };
  } finally {
    refreshInFlight = null;
  }
}

export async function posApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const extra =
    init.headers && typeof init.headers === 'object' && !(init.headers instanceof Headers)
      ? (init.headers as Record<string, string>)
      : undefined;

  const run = () =>
    fetch(path, {
      ...init,
      headers: posApiAuthHeaders(extra),
    });

  let res = await run();
  if (res.status === 401 && loadPosApiToken()) {
    const refreshed = await refreshPosApiToken();
    if (refreshed.ok) res = await run();
  }
  return res;
}

export function startPosApiTokenRefreshScheduler(): void {
  if (refreshTimer != null) return;
  const tick = () => {
    const token = loadPosApiToken();
    if (!token) return;
    if (posApiTokenNeedsRefresh(token)) {
      void refreshPosApiToken();
    }
  };
  refreshTimer = setInterval(tick, SCHEDULER_MS);
  tick();
}

export function stopPosApiTokenRefreshScheduler(): void {
  if (refreshTimer != null) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
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
    startPosApiTokenRefreshScheduler();
    return { ok: true, token: data.token };
  } catch {
    return { ok: false, error: 'API token isteği başarısız' };
  }
}
