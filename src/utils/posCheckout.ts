import type { SalePaymentSplit } from '../types/pos';

export function validatePaymentSplits(
  total: number,
  splits: SalePaymentSplit[],
): string | null {
  if (splits.length < 2) return 'Bölünmüş ödeme için en az iki satır gerekli.';
  const sum = splits.reduce((acc, row) => acc + row.amount, 0);
  if (Math.round(sum * 100) !== Math.round(total * 100)) {
    return `Bölünmüş tutarlar toplamı ${sum.toFixed(2)} — satış ${total.toFixed(2)} ile uyuşmuyor.`;
  }
  for (const row of splits) {
    if (row.amount <= 0) return 'Her ödeme satırı pozitif olmalı.';
  }
  return null;
}

export function computeChange(total: number, cashTendered: number): number {
  return Math.round(Math.max(0, cashTendered - total) * 100) / 100;
}

export function quickCashTenderAmounts(total: number): number[] {
  const base = Math.ceil(total);
  const candidates = new Set<number>([
    base,
    Math.ceil(total / 10) * 10,
    Math.ceil(total / 50) * 50,
    Math.ceil(total / 100) * 100,
    base + 10,
    base + 50,
  ]);
  return [...candidates].filter((v) => v >= total).sort((a, b) => a - b).slice(0, 6);
}
