export type LoginMethod = 'password' | 'pin';

export interface LoginAuditEntry {
  id: string;
  sessionId?: string;
  userId?: string;
  username: string;
  displayName?: string;
  success: boolean;
  method: LoginMethod;
  deviceInfo: string;
  clientIp?: string;
  createdAt: string;
  failureReason?: string;
}

export interface LoginLockoutRecord {
  username: string;
  failedAttempts: number;
  lockedUntil: string | null;
  requiresAdminUnlock: boolean;
  lastAttemptAt: string;
}

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;
export const IDLE_LOGOUT_MS = 5 * 60 * 1000;
export const MAX_LOGIN_AUDIT_ENTRIES = 200;

export type AdminApprovalReason =
  | 'user_delete'
  | 'price_change'
  | 'refund'
  | 'backup_import'
  | 'backup_push';
