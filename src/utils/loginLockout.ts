import type { LoginLockoutRecord } from '../types/security';
import { LOGIN_LOCKOUT_MS, LOGIN_MAX_ATTEMPTS } from '../types/security';

const STORAGE_KEY = 'market-pos-login-lockouts';

function loadLockouts(): LoginLockoutRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LoginLockoutRecord[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveLockouts(records: LoginLockoutRecord[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

/** Eski sürümlerdeki "yönetici onayı" bayrağı — sunucu kilidi değil, tarayıcı sayacı */
export function purgeLegacyLoginLockouts(): void {
  const records = loadLockouts();
  const next = records.filter((item) => !item.requiresAdminUnlock);
  if (next.length !== records.length) {
    saveLockouts(next);
  }
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

  if (record.lockedUntil) {
    const lockedUntilMs = new Date(record.lockedUntil).getTime();
    const remaining = lockedUntilMs - Date.now();
    if (remaining > 0) {
      const minutes = Math.ceil(remaining / 60000);
      return {
        allowed: false,
        message: `Bu tarayıcıda çok fazla hatalı deneme yapıldı. ${minutes} dakika bekleyin veya doğru şifreyle tekrar deneyin.`,
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
    requiresAdminUnlock: false,
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
  clearLoginLockout(username);
}
