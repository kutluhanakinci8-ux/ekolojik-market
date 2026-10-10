#!/usr/bin/env npx tsx
/**
 * Lima fiş formatı — birim testleri (tsx)
 */
import assert from 'node:assert/strict';
import {
  formatReceiptBrandName,
  formatReceiptMoneyPlain,
  sanitizeReceiptVisibleText,
  RECEIPT_DRIVER_SACRIFICE_LINES,
  RECEIPT_SACRIFICE_FILL,
} from '../../src/utils/receiptFormat.ts';
import {
  buildPlainTextSaleReceipt,
  buildGreenleafPremiumReceiptHtml,
  type SaleReceiptData,
} from '../../src/utils/receiptPrint.ts';

let failed = 0;

function ok(name: string) {
  console.log(`  ok  ${name}`);
}

function bad(name: string, err: unknown) {
  console.error(`  FAIL ${name}:`, err instanceof Error ? err.message : err);
  failed += 1;
}

function test(name: string, fn: () => void) {
  try {
    fn();
    ok(name);
  } catch (e) {
    bad(name, e);
  }
}

const sample: SaleReceiptData = {
  businessName: 'Lima Market',
  createdAt: new Date('2026-10-09T12:00:00'),
  paymentMethod: 'card',
  total: 807,
  saleId: 'S1',
  receiptNo: 'SIM-1',
  items: [
    { name: 'Ürün A', quantity: 1, unitPrice: 599.28, lineTotal: 599.28 },
    { name: 'Ürün B', quantity: 1, unitPrice: 208.54, lineTotal: 208.54 },
  ],
};

test('sanitize: zero-width ve kontrol karakterleri', () => {
  assert.equal(sanitizeReceiptVisibleText('  Lima\u200b Market  '), 'Lima Market');
});

test('formatReceiptBrandName: TR büyük harf (İ)', () => {
  assert.equal(formatReceiptBrandName('lima market'), 'LİMA MARKET');
});

test('formatReceiptMoneyPlain: TL soneki', () => {
  const s = formatReceiptMoneyPlain(807);
  assert.ok(s.includes('807') && s.trimEnd().endsWith('TL'));
});

test('plain fiş: sacrifice kapalı ham yazdır yolu', () => {
  const text = buildPlainTextSaleReceipt(sample, { sacrificeLines: false });
  const brand = formatReceiptBrandName(sample.businessName);
  assert.ok(text.startsWith(brand));
  const fillLine = RECEIPT_SACRIFICE_FILL.repeat(30);
  assert.ok(!text.split('\n').some((l) => l === fillLine));
  assert.ok(text.includes('TOPLAM'));
});

test('plain fiş: sacrifice açık CUPS yedek', () => {
  const text = buildPlainTextSaleReceipt(sample, { sacrificeLines: true });
  const fillLine = RECEIPT_SACRIFICE_FILL.repeat(30);
  const lines = text.split('\n');
  assert.equal(lines.filter((l) => l === fillLine).length, RECEIPT_DRIVER_SACRIFICE_LINES);
});

test('premium HTML: marka ve tablo, script yokken güvenli alanlar', () => {
  const html = buildGreenleafPremiumReceiptHtml(sample);
  const brand = formatReceiptBrandName(sample.businessName);
  assert.ok(html.includes(`class="rp-brand">${brand}</div>`));
  assert.ok(html.includes('class="rp-total-amt">'));
  assert.ok(html.includes('SATIŞ FİŞİ'));
  assert.ok(!html.includes('\u200b'));
  assert.ok(html.includes('1 x '));
});

if (failed > 0) {
  console.error(`\nLima receipt unit: ${failed} failed`);
  process.exit(1);
}
console.log('\nLima receipt unit: PASS');
