import { isPlatformOperatorUsername } from './platformOperators.mjs';

export async function assertTenantStoreWriteAllowed(username, targetTenantId, dataDir) {
  const user = String(username ?? '').trim().toLowerCase();
  if (isPlatformOperatorUsername(user)) {
    return { ok: true };
  }
  if (dataDir && targetTenantId) {
    const { isTenantReadOnly } = await import('./platformTenantLifecycle.mjs');
    if (await isTenantReadOnly(dataDir, targetTenantId)) {
      return {
        ok: false,
        status: 403,
        error: 'Mağaza salt okunur modda. Değişiklik yapılamaz.',
      };
    }
  }
  return { ok: true };
}
