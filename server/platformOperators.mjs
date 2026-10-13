/** Ekolojik platform — tüm kiracıları yöneten operatör hesapları (mağaza store.json içinde değil) */
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

export function normalizePlatformOperatorUsername(username) {
  const raw = String(username ?? '').trim().toLowerCase();
  return PLATFORM_OPERATOR_ALIASES.get(raw) ?? raw;
}

export function isPlatformOperatorUsername(username) {
  return PLATFORM_OPERATOR_USERNAMES.has(normalizePlatformOperatorUsername(username));
}

export function isPlatformApiRole(role) {
  return role === 'platform';
}

/** Greenleaf store.json içinde artık bulunmaz — yalnızca platform kasası */
const DEDICATED_PLATFORM_ONLY = new Set(['kutluhan08']);

export function isDedicatedPlatformOnlyUsername(username) {
  return DEDICATED_PLATFORM_ONLY.has(normalizePlatformOperatorUsername(username));
}
