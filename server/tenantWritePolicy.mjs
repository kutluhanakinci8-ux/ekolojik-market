const PLATFORM_TENANT_ADMIN_USERNAMES = new Set(['yonetici']);

const GREENLEAF_ONLY_ADMIN_USERNAMES = new Set([
  'kutluhan08',
  'kutluhan',
  'kutluhanakinci8',
]);

export function assertTenantStoreWriteAllowed(username, targetTenantId) {
  const user = String(username ?? '').trim().toLowerCase();
  const tenant = String(targetTenantId ?? 'main').trim() || 'main';
  if (PLATFORM_TENANT_ADMIN_USERNAMES.has(user)) {
    return { ok: true };
  }
  if (GREENLEAF_ONLY_ADMIN_USERNAMES.has(user) && tenant !== 'main') {
    return {
      ok: false,
      status: 403,
      error: 'Bu hesap yalnızca Greenleaf Market (main) verisini güncelleyebilir. Lima için platform yöneticisi girişi gerekir.',
    };
  }
  return { ok: true };
}
