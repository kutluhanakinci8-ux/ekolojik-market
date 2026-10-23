import { PLATFORM_TENANT_ID } from '../config/platformOperators';
import { tenantLocalStorageSuffix } from '../storage/posLocalStorageKeys';
import { DEFAULT_TENANT_ID, loadTenantId } from '../storage/tenantSession';

function tokenStorageKey(tenantId?: string): string {
  return `market-pos-api-token${tenantLocalStorageSuffix(tenantId)}`;
}
const TOKEN_VERSION = 'v1';
/** Sunucu TTL 24h — bitime 4h kala yenile */
const REFRESH_WITHIN_MS = 4 * 60 * 60 * 1000;
const SCHEDULER_MS = 5 * 60 * 1000;

let refreshTimer: ReturnType<typeof setInterval> | null = null;
let refreshInFlight: Promise<{ ok: boolean; error?: string }> | null = null;

function tenantQuery(tenantOverride?: string): string {
  const tenant = tenantOverride ?? loadTenantId();
  if (!tenant || tenant === DEFAULT_TENANT_ID) return '';
  if (tenant === PLATFORM_TENANT_ID) {
    return `?tenant=${encodeURIComponent(PLATFORM_TENANT_ID)}`;
  }
  return `?tenant=${encodeURIComponent(tenant)}`;
}

export function loadPosApiToken(tenantId?: string): string | null {
  try {
    if (tenantId !== undefined) {
      const raw = sessionStorage.getItem(tokenStorageKey(tenantId));
      return raw?.trim() || null;
    }
    const active = sessionStorage.getItem(tokenStorageKey(loadTenantId()));
    if (active?.trim()) return active.trim();
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i);
      if (!key?.startsWith('market-pos-api-token')) continue;
      const raw = sessionStorage.getItem(key);
      if (raw?.trim()) return raw.trim();
    }
    return null;
  } catch {
    return null;
  }
}

/** Girişten sonra token aktif mağaza anahtarına kopyalanır (tenant değişiminde kaybolmasın). */
export function syncPosApiTokenToCurrentTenant(savedUnderTenant?: string): void {
  const token = (savedUnderTenant ? loadPosApiToken(savedUnderTenant) : null) ?? loadPosApiToken();
  if (!token) return;
  savePosApiToken(token, loadTenantId());
}

export function savePosApiToken(token: string, tenantId?: string): void {
  sessionStorage.setItem(tokenStorageKey(tenantId), token);
}

export function clearPosApiToken(): void {
  sessionStorage.removeItem(tokenStorageKey());
}

export function clearPosApiTokensForAllKnownTenants(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('market-pos-api-token')) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
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

export async function exchangePosApiToken(
  credentials: {
    username: string;
    password?: string;
    pin?: string;
  },
  tenantId?: string,
): Promise<{
  ok: boolean;
  token?: string;
  error?: string;
  httpStatus?: number;
  role?: string;
  tenantId?: string;
  user?: Record<string, unknown>;
}> {
  const authTenant = tenantId ?? loadTenantId();
  const tokenUrl = `/api/auth/pos-token${tenantQuery(authTenant)}`;
  const TOKEN_TIMEOUT_MS = 25_000;

  const requestOnce = async () => {
    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(credentials),
      signal: AbortSignal.timeout(TOKEN_TIMEOUT_MS),
    });
    let data: {
      ok?: boolean;
      token?: string;
      message?: string;
      role?: string;
      tenantId?: string;
      user?: Record<string, unknown>;
    };
    try {
      data = (await res.json()) as typeof data;
    } catch {
      return {
        ok: false as const,
        httpStatus: res.status,
        error: res.ok
          ? 'Sunucu yanıtı okunamadı — sayfayı yenileyip tekrar deneyin'
          : `Sunucu hatası (${res.status}) — biraz sonra tekrar deneyin`,
      };
    }
    if (!res.ok || !data.ok || !data.token) {
      return {
        ok: false as const,
        httpStatus: res.status,
        error: data.message ?? 'API token alınamadı',
      };
    }
    const tokenTenant =
      data.tenantId === PLATFORM_TENANT_ID || data.role === 'platform'
        ? PLATFORM_TENANT_ID
        : authTenant;
    savePosApiToken(data.token, tokenTenant);
    savePosApiToken(data.token, loadTenantId());
    syncPosApiTokenToCurrentTenant(tokenTenant);
    startPosApiTokenRefreshScheduler();
    return {
      ok: true as const,
      token: data.token,
      role: data.role,
      tenantId: data.tenantId ?? tokenTenant,
      user: data.user,
    };
  };

  try {
    return await requestOnce();
  } catch (firstErr) {
    try {
      await new Promise((resolve) => setTimeout(resolve, 700));
      return await requestOnce();
    } catch (secondErr) {
      const err = secondErr ?? firstErr;
      if (err instanceof Error && err.name === 'TimeoutError') {
        return {
          ok: false,
          error: 'Sunucu yanıt vermedi (25 sn). Ağı kontrol edip tekrar deneyin.',
        };
      }
      return {
        ok: false,
        error: 'Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.',
      };
    }
  }
}
