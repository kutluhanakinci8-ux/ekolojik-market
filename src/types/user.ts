import type { AppPage } from '../components/AppShell';

export type UserRole = 'admin' | 'cashier';

export interface PosUser {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  allowedTabs: AppPage[];
  isActive: boolean;
  isPrimaryAdmin?: boolean;
  createdAt: string;
  updatedAt: string;
  mustChangePassword?: boolean;
  pinHash?: string;
  totpSecret?: string;
  totpEnabled?: boolean;
}

export interface AuthSession {
  userId: string;
  sessionId: string;
  username: string;
  displayName: string;
  role: UserRole;
  allowedTabs: AppPage[];
  loggedInAt: string;
  mustChangePassword?: boolean;
}

export type LoginResult =
  | { status: 'success' }
  | { status: 'error'; message: string }
  | { status: 'totp_required'; userId: string; username: string }
  | { status: 'locked'; message: string; retryAfterMs?: number };

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Yönetici',
  cashier: 'Kasiyer',
};
