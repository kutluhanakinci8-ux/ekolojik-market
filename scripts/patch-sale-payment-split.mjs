#!/usr/bin/env node
/**
 * Tek satışın ödeme tipini bölünmüş (nakit+kart) yapar.
 * Kullanım:
 *   node scripts/patch-sale-payment-split.mjs S1792510918514 181.01 600
 * (tutarlar satış toplamına eşit olmalı)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [saleId, cashStr, cardStr] = process.argv.slice(2);
if (!saleId || !cashStr || !cardStr) {
  console.error('Kullanım: node scripts/patch-sale-payment-split.mjs <saleId> <nakit> <kart>');
  process.exit(1);
}

const cash = Math.round(parseFloat(cashStr.replace(',', '.')) * 100) / 100;
const card = Math.round(parseFloat(cardStr.replace(',', '.')) * 100) / 100;
const dataDir = process.env.MARKET_POS_DATA_DIR?.trim() || join(process.cwd(), 'data');
const storePath = join(dataDir, 'store.json');

const raw = JSON.parse(await readFile(storePath, 'utf8'));
const sales = raw.sales ?? [];
const idx = sales.findIndex((s) => s.id === saleId);
if (idx < 0) {
  console.error('Satış bulunamadı:', saleId);
  process.exit(1);
}
const sale = sales[idx];
const total = Math.round(Number(sale.total) * 100) / 100;
const sum = Math.round((cash + card) * 100) / 100;
if (sum !== total) {
  console.error(`Toplam uyuşmuyor: nakit+kart=${sum} satış=${total}`);
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
  paymentCorrectionNote: 'Nakit+kart düzeltme (patch-sale-payment-split)',
};

await writeFile(storePath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
console.log('OK', saleId, 'split', cash, '+', card, '=', total);
