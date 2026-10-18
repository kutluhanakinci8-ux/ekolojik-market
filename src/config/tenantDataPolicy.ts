import { isPlatformOperatorUsername } from './platformOperators';

/** Tüm kiracı verilerini sunucuya yazabilir (platform operatörü) */
export function isPlatformTenantAdmin(username: string): boolean {
  return isPlatformOperatorUsername(username);
}

/** Bu kullanıcı sunucuya veri yazabilir mi? (otomatik senkron / Sunucuya Yükle) */
export function canPushTenantDataToServer(_username: string, _tenantId: string): boolean {
  return true;
}
