import { isOwnerAdminUsername } from './ownerAdminUsers';
import { isPlatformTenantAdmin } from './tenantDataPolicy';
import { DEFAULT_TENANT_ID, normalizeStoreCodeInput } from '../storage/tenantSession';

/** Greenleaf sahibi hesaplar yanlışlıkla lima-market tenant ile API'ye gitmesin */
export function resolveLoginTenantId(username: string, tenantFromForm: string): string {
  const user = username.trim().toLowerCase();
  const tenant = normalizeStoreCodeInput(tenantFromForm);
  if (isOwnerAdminUsername(user)) {
    return DEFAULT_TENANT_ID;
  }
  if (isPlatformTenantAdmin(user)) {
    return tenant;
  }
  return tenant;
}
