/** Termal fiş — saf formatlama (test edilebilir, DOM yok) */

export const RECEIPT_DRIVER_SACRIFICE_LINES = 4;
export const RECEIPT_SACRIFICE_FILL = '-';

export function sanitizeReceiptVisibleText(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatReceiptBrandName(name: string): string {
  return sanitizeReceiptVisibleText(name).toLocaleUpperCase('tr-TR');
}

export function formatReceiptMoneyPlain(amount: number): string {
  return `${new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)} TL`;
}

export function formatReceiptDateTime(date: Date): string {
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export function truncateReceiptName(name: string, max = 32): string {
  if (name.length <= max) return name;
  return `${name.slice(0, max - 1)}…`;
}

export function escapeReceiptHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
