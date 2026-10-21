#!/usr/bin/env node
/**
 * 20.10.2026 — ödeme düzeltmeleri (canlı data).
 *   S1792511173681 → tam nakit (648,01)
 *   S1792510918514 → nakit 181,01 + kart 600,00 (toplam 781,01)
 *
 * VPS:
 *   cd /var/www/ekolojik-market-pos
 *   MARKET_POS_DATA_DIR=/var/www/ekolojik-market-pos/data node scripts/patch-sales-2026-10-20-payments.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dataDir = process.env.MARKET_POS_DATA_DIR?.trim() || join(process.cwd(), 'data');
const storePath = join(dataDir, 'store.json');

const FIXES = [
  { id: 'S1792511173681', kind: 'cash' },
  { id: 'S1792510918514', kind: 'split', cash: 181.01, card: 600 },
];

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

const raw = JSON.parse(await readFile(storePath, 'utf8'));
const sales = raw.sales ?? [];

for (const fix of FIXES) {
  const idx = sales.findIndex((s) => s.id === fix.id);
  if (idx < 0) {
    console.error('Satış bulunamadı:', fix.id);
    process.exit(1);
  }
  const sale = sales[idx];
  const total = round2(sale.total);

  if (fix.kind === 'cash') {
    sales[idx] = {
      ...sale,
      paymentMethod: 'cash',
      paymentSplits: undefined,
      cashTendered: total,
      changeGiven: 0,
      paymentCorrectedAt: new Date().toISOString(),
      paymentCorrectionNote: '20.10.2026 nakit düzeltme',
    };
    console.log('OK', fix.id, '→ nakit', total);
    continue;
  }

  const cash = round2(fix.cash);
  const card = round2(fix.card);
  if (round2(cash + card) !== total) {
    console.error(`${fix.id}: nakit+kart ${cash + card} ≠ satış ${total}`);
    process.exit(1);
  }
  sales[idx] = {
    ...sale,
    paymentMethod: 'split',
    paymentSplits: [
      { method: 'cash', amount: cash },
      { method: 'card', amount: card },
    ],
    cashTendered: cash,
    changeGiven: 0,
    paymentCorrectedAt: new Date().toISOString(),
    paymentCorrectionNote: '20.10.2026 nakit+kart düzeltme',
  };
  console.log('OK', fix.id, '→ split', cash, '+', card, '=', total);
}

await writeFile(storePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log('store.json güncellendi:', storePath);
