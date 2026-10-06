import type { LoginLockoutRecord } from '../types/security';
import { LOGIN_LOCKOUT_MS, LOGIN_MAX_ATTEMPTS } from '../types/security';

const STORAGE_KEY = 'market-pos-login-lockouts';

function loadLockouts(): LoginLockoutRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoginLockoutRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLockouts(records: LoginLockoutRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function getLoginLockout(username: string): LoginLockoutRecord | null {
  const normalized = username.trim().toLowerCase();
  return loadLockouts().find((item) => item.username === normalized) ?? null;
}

export function getAllLoginLockouts(): LoginLockoutRecord[] {
  return loadLockouts();
}

export function checkLoginAllowed(username: string): { allowed: boolean; message?: string; retryAfterMs?: number } {
  const record = getLoginLockout(username);
  if (!record) return { allowed: true };

  if (record.requiresAdminUnlock) {
    if (record.lockedUntil) {
      const lockedUntilMs = new Date(record.lockedUntil).getTime();
      const remaining = lockedUntilMs - Date.now();
      if (remaining > 0) {
        const minutes = Math.ceil(remaining / 60000);
        return {
          allowed: false,
          message: `Çok fazla hatalı deneme. ${minutes} dakika bekleyin ve yönetici onayı gerekir.`,
          retryAfterMs: remaining,
        };
      }
    }
    return {
      allowed: false,
      message: 'Hesap kilitli. Yönetici onayı bekleniyor.',
    };
  }

  if (record.lockedUntil) {
    const lockedUntilMs = new Date(record.lockedUntil).getTime();
    const remaining = lockedUntilMs - Date.now();
    if (remaining > 0) {
      const minutes = Math.ceil(remaining / 60000);
      return {
        allowed: false,
        message: `Çok fazla hatalı deneme. ${minutes} dakika sonra tekrar deneyin.`,
        retryAfterMs: remaining,
      };
    }
  }

  return { allowed: true };
}

export function recordFailedLogin(username: string): LoginLockoutRecord {
  const normalized = username.trim().toLowerCase();
  const now = new Date().toISOString();
  const records = loadLockouts();
  const existing = records.find((item) => item.username === normalized);

  const failedAttempts = (existing?.failedAttempts ?? 0) + 1;
  const shouldLock = failedAttempts >= LOGIN_MAX_ATTEMPTS;
  const record: LoginLockoutRecord = {
    username: normalized,
    failedAttempts: shouldLock ? LOGIN_MAX_ATTEMPTS : failedAttempts,
    lockedUntil: shouldLock ? new Date(Date.now() + LOGIN_LOCKOUT_MS).toISOString() : existing?.lockedUntil ?? null,
    requiresAdminUnlock: shouldLock ? true : (existing?.requiresAdminUnlock ?? false),
    lastAttemptAt: now,
  };

  const next = records.filter((item) => item.username !== normalized);
  next.push(record);
  saveLockouts(next);
  return record;
}

export function clearLoginLockout(username: string): void {
  const normalized = username.trim().toLowerCase();
  saveLockouts(loadLockouts().filter((item) => item.username !== normalized));
}

export function adminUnlockLogin(username: string): void {
  const normalized = username.trim().toLowerCase();
  const records = loadLockouts();
  const existing = records.find((item) => item.username === normalized);
  if (!existing) return;

  const updated: LoginLockoutRecord = {
    ...existing,
    failedAttempts: 0,
    lockedUntil: null,
    requiresAdminUnlock: false,
    lastAttemptAt: new Date().toISOString(),
  };

  saveLockouts(records.map((item) => (item.username === normalized ? updated : item)));
}
