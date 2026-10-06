const LAST_QUICK_USER_KEY = 'market-pos-last-quick-user';

export function saveLastQuickUser(username: string): void {
  sessionStorage.setItem(LAST_QUICK_USER_KEY, username.trim().toLowerCase());
}

export function loadLastQuickUser(): string | null {
  try {
    return sessionStorage.getItem(LAST_QUICK_USER_KEY);
  } catch {
    return null;
  }
}

export function clearLastQuickUser(): void {
  sessionStorage.removeItem(LAST_QUICK_USER_KEY);
}
