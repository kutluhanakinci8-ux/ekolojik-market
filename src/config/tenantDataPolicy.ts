import { DEFAULT_TENANT_ID } from '../storage/tenantSession';
import { isOwnerAdminUsername } from './ownerAdminUsers';

/** Tüm mağaza tenant verilerini sunucuya yazabilir (platform yöneticisi) */
export const PLATFORM_TENANT_ADMIN_USERNAMES = new Set(['yonetici']);

export function isPlatformTenantAdmin(username: string): boolean {
  return PLATFORM_TENANT_ADMIN_USERNAMES.has(username.trim().toLowerCase());
}

/** Bu kullanıcı sunucuya veri yazabilir mi? (otomatik senkron / Sunucuya Yükle) */
export function canPushTenantDataToServer(username: string, tenantId: string): boolean {
  const normalized = username.trim().toLowerCase();
  const tenant = tenantId.trim() || DEFAULT_TENANT_ID;
  if (isPlatformTenantAdmin(normalized)) return true;
  if (isOwnerAdminUsername(normalized)) {
    return tenant === DEFAULT_TENANT_ID;
  }
  return true;
}
