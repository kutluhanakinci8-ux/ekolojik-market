import type { PosUser } from '../types/user';
import { ALL_APP_PAGES } from '../data/navigation';
import { isOwnerAdminUsername } from '../config/ownerAdminUsers';

/** Mağaza sahibi hesapları → tam admin (sunucu + tüm cihazlar) */
export function elevateOwnerAdmins(users: PosUser[]): PosUser[] {
  const now = new Date().toISOString();
  return users.map((user) => {
    if (!isOwnerAdminUsername(user.username)) return user;
    return {
      ...user,
      role: 'admin',
      allowedTabs: [...ALL_APP_PAGES],
      isActive: true,
      updatedAt: now,
    };
  });
}
