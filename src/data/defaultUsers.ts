import type { PosUser } from '../types/user';
import { DEFAULT_CASHIER_TABS } from './navigation';

/** Varsayılan: yonetici / yonetici123 */
export const DEFAULT_ADMIN_PASSWORD_HASH =
  '6e4896950cae800fae0e3e1ae26f1ee90e9a70c7c30fb95715f28be0ce13eac0';

/** Varsayılan: kasiyer / kasiyer123 */
export const DEFAULT_CASHIER_PASSWORD_HASH =
  'c2b3ad8c4da0c33240128ade14f44f9996407e1df97b97564c26e6da292fd715';

export const PRIMARY_ADMIN_ID = 'U-admin';

const now = new Date().toISOString();

export const DEFAULT_USERS: PosUser[] = [
  {
    id: PRIMARY_ADMIN_ID,
    username: 'yonetici',
    displayName: 'Yönetici',
    passwordHash: DEFAULT_ADMIN_PASSWORD_HASH,
    role: 'admin',
    allowedTabs: [
      'dashboard',
      'sales',
      'stock',
      'reports',
      'accounting',
      'transactions',
      'customers',
      'cashier',
      'posta',
      'settings',
    ],
    isActive: true,
    isPrimaryAdmin: true,
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'U-kasiyer',
    username: 'kasiyer',
    displayName: 'Kasiyer',
    passwordHash: DEFAULT_CASHIER_PASSWORD_HASH,
    role: 'cashier',
    allowedTabs: [...DEFAULT_CASHIER_TABS],
    isActive: true,
    mustChangePassword: true,
    createdAt: now,
    updatedAt: now,
  },
];
