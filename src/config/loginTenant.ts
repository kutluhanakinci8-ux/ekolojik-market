import { isDedicatedPlatformOnlyUsername, PLATFORM_TENANT_ID } from './platformOperators';
import { normalizeStoreCodeInput } from '../storage/tenantSession';

/** Platform operatörü (kutluhan08) kiracı kodu gerektirmez; diğerleri formdaki mağaza kodunu kullanır */
export function resolveLoginTenantId(username: string, tenantFromForm: string): string {
  const user = username.trim().toLowerCase();
  const tenant = normalizeStoreCodeInput(tenantFromForm);
  if (isDedicatedPlatformOnlyUsername(user)) {
    return PLATFORM_TENANT_ID;
  }
  return tenant;
}
