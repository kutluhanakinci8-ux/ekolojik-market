import { isPlatformOperatorUsername } from './platformOperators.mjs';

export function assertTenantStoreWriteAllowed(username, _targetTenantId) {
  const user = String(username ?? '').trim().toLowerCase();
  if (isPlatformOperatorUsername(user)) {
    return { ok: true };
  }
  return { ok: true };
}
