import { DEFAULT_TENANT_ID } from '../storage/tenantSession';

/** Platform konsolu — kiracı store.json kullanıcısı değil */
export const PLATFORM_TENANT_ID = '__platform__';

const PLATFORM_OPERATOR_USERNAMES = new Set([
  'kutluhan08',
  'kutluhan',
  'kutluhanakinci8',
  'yonetici',
]);

const PLATFORM_OPERATOR_ALIASES = new Map([
  ['kutluhan', 'kutluhan08'],
  ['kutluhanakinci8', 'kutluhan08'],
]);

export function normalizePlatformOperatorUsername(username: string): string {
  const raw = username.trim().toLowerCase();
  return PLATFORM_OPERATOR_ALIASES.get(raw) ?? raw;
}

export function isPlatformOperatorUsername(username: string): boolean {
  return PLATFORM_OPERATOR_USERNAMES.has(normalizePlatformOperatorUsername(username));
}

export function isPlatformTenantId(tenantId: string): boolean {
  const t = tenantId.trim();
  return t === PLATFORM_TENANT_ID;
}

export function isPlatformApiRole(role: string | undefined): boolean {
  return role === 'platform';
}

const DEDICATED_PLATFORM_ONLY = new Set(['kutluhan08']);

export function isDedicatedPlatformOnlyUsername(username: string): boolean {
  return DEDICATED_PLATFORM_ONLY.has(normalizePlatformOperatorUsername(username));
}

/** POS açıkken hangi kiracının verisi yüklenecek */
export function resolveActivePosTenantId(storedTenantId: string): string {
  const t = storedTenantId.trim();
  if (!t || t === PLATFORM_TENANT_ID) return DEFAULT_TENANT_ID;
  return t;
}
