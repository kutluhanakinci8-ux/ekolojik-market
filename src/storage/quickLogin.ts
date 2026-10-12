import { tenantLocalStorageSuffix } from './posLocalStorageKeys';

function lastQuickUserKey(): string {
  return `market-pos-last-quick-user${tenantLocalStorageSuffix()}`;
}

export function saveLastQuickUser(username: string): void {
  sessionStorage.setItem(lastQuickUserKey(), username.trim().toLowerCase());
}

export function loadLastQuickUser(): string | null {
  try {
    return sessionStorage.getItem(lastQuickUserKey());
  } catch {
    return null;
  }
}

export function clearLastQuickUser(): void {
  sessionStorage.removeItem(lastQuickUserKey());
}
