export function getBusinessDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getBusinessDateKeyFromIso(iso: string): string {
  return getBusinessDateKey(new Date(iso));
}

export function isSameBusinessDay(iso: string, date = new Date()): boolean {
  return getBusinessDateKeyFromIso(iso) === getBusinessDateKey(date);
}

export function getPreviousBusinessDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return getBusinessDateKey(date);
}

export function getNextBusinessDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + 1);
  return getBusinessDateKey(date);
}
