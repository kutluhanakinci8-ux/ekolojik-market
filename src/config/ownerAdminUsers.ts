/** Tam yetkili mağaza sahibi — tüm sekmeler + yönetici onayları */
export const OWNER_ADMIN_USERNAMES = new Set(
  ['kutluhan08', 'kutluhan', 'kutluhanakinci8'].map((u) => u.toLowerCase()),
);

export function isOwnerAdminUsername(username: string): boolean {
  return OWNER_ADMIN_USERNAMES.has(username.trim().toLowerCase());
}
