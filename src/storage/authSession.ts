import type { AuthSession } from '../types/user';
import { tenantLocalStorageSuffix } from './posLocalStorageKeys';
import { loadTenantId } from './tenantSession';

function sessionStorageKey(): string {
  return `market-pos-auth-session${tenantLocalStorageSuffix()}`;
}

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = sessionStorage.getItem(sessionStorageKey());
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.sessionId) {
      session.sessionId = `S-legacy-${session.loggedInAt ?? Date.now()}`;
    }
    const tenantId = (session as AuthSession & { tenantId?: string }).tenantId;
    if (tenantId && tenantId !== loadTenantId()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  const withTenant = { ...session, tenantId: loadTenantId() };
  sessionStorage.setItem(sessionStorageKey(), JSON.stringify(withTenant));
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(sessionStorageKey());
}

/** Tenant değişiminde diğer mağaza oturumlarını temizle */
export function clearAuthSessionsForAllKnownTenants(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k?.startsWith('market-pos-auth-session')) keys.push(k);
    }
    for (const k of keys) sessionStorage.removeItem(k);
  } catch {
    /* ignore */
  }
}
