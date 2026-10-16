#!/usr/bin/env node
/**
 * Fotoğraftaki fişler — %50 satış fiyatı + nakit (sunucu store.json).
 * Satış yoksa fiş satırlarından ekler (stok dokunulmaz).
 *
 * Kullanım: node scripts/fix-receipt-sales-payment-cash.mjs [/var/www/market-pos/data]
 */
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';
import { PRICE_BATCH_1_CODE_BY_PRODUCT_ID } from '../server/irsaliyeStock.mjs';

const CODE_TO_PRODUCT_ID = Object.fromEntries(
  Object.entries(PRICE_BATCH_1_CODE_BY_PRODUCT_ID).map(([id, code]) => [code, Number(id)]),
);

const CODE_ALIASES = {
  LG1019: 'LGI019',
  LB019: 'LGI019',
  ASF006: 'ASF066',
  SEA069: 'SAA069',
};

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function resolveProductId(code) {
  const normalized = CODE_ALIASES[code] ?? code;
  return CODE_TO_PRODUCT_ID[normalized];
}

/** @type {Array<{ priceFactor: number, label: string, sales: object[] }>} */
const RECEIPT_BATCHES = [
  {
    priceFactor: 0.5,
    label: '%50 + nakit',
    sales: [
  {
    id: 'S1792152021394',
    createdAt: '2026-10-16T12:00:21.000Z',
    businessDate: '2026-10-16',
    lines: [
      { code: 'CCA016', qty: 1, unitPrice: 370 },
      { code: 'ASB046', qty: 1, unitPrice: 290 },
      { code: 'SBC053', qty: 1, unitPrice: 814 },
    ],
  },
  {
    id: 'S1792151646521',
    altIds: ['S1792151645521'],
    createdAt: '2026-10-16T11:54:06.000Z',
    businessDate: '2026-10-16',
    lines: [
      { code: 'CBF015', qty: 1, unitPrice: 148 },
      { code: 'SBJ064', qty: 1, unitPrice: 536 },
      { code: 'DAA108', qty: 1, unitPrice: 482 },
      { code: 'CAB040', qty: 1, unitPrice: 592 },
      { code: 'CAA039', qty: 1, unitPrice: 690 },
      { code: 'CAA038', qty: 1, unitPrice: 592 },
    ],
  },
  {
    id: 'S1792151611448',
    createdAt: '2026-10-16T11:53:31.000Z',
    businessDate: '2026-10-16',
    /** Fişteki ek indirim (satır %50 sonrası) → toplam 1.972 − 268 = 1.704 ₺ */
    additionalDiscountTl: 268,
    lines: [
      { code: 'CBF015', qty: 1, unitPrice: 148 },
      { code: 'SBJ064', qty: 2, unitPrice: 536 },
      { code: 'DAA108', qty: 1, unitPrice: 482 },
      { code: 'CAB040', qty: 1, unitPrice: 592 },
      { code: 'CAA038', qty: 1, unitPrice: 592 },
      { code: 'CAA039', qty: 1, unitPrice: 690 },
      { code: 'ASF055', qty: 1, unitPrice: 368 },
    ],
  },
  {
    id: 'S1792151840042',
    createdAt: '2026-10-16T11:57:20.000Z',
    businessDate: '2026-10-16',
    lines: [
      { code: 'LGI019', qty: 1, unitPrice: 496 },
      { code: 'ASF066', qty: 1, unitPrice: 148 },
      { code: 'DAA062', qty: 1, unitPrice: 290 },
    ],
  },
    ],
  },
  {
    priceFactor: 1,
    label: 'kart→nakit (tutar aynı)',
    sales: [
      {
        id: 'S1792152528273',
        createdAt: '2026-10-16T12:08:48.000Z',
        businessDate: '2026-10-16',
        paymentMethod: 'transfer',
        paymentNote: 'Fiş düzeltmesi: havale (tutar aynı)',
        keepAmountsWhenExists: true,
        expectedTotal: 1403.5,
        lines: [
          { code: 'DAB089', qty: 2, unitPrice: 120.73 },
          { code: 'DAA062', qty: 1, unitPrice: 145.01 },
          { code: 'ASB046', qty: 1, unitPrice: 145.01 },
          { code: 'FPA151', qty: 2, unitPrice: 436.01 },
        ],
      },
      {
        id: 'S1792152619316',
        createdAt: '2026-10-16T12:10:19.000Z',
        businessDate: '2026-10-16',
        keepAmountsWhenExists: true,
        expectedTotal: 436.01,
        lines: [{ code: 'FPA151', qty: 1, unitPrice: 436.01 }],
      },
      {
        id: 'S1792152285521',
        createdAt: '2026-10-16T12:04:45.000Z',
        businessDate: '2026-10-16',
        keepAmountsWhenExists: true,
        expectedTotal: 395.75,
        lines: [
          { code: 'DAB089', qty: 1, unitPrice: 120.73 },
          { code: 'SAA069', qty: 1, unitPrice: 130.01 },
          { code: 'ASB046', qty: 1, unitPrice: 145.01 },
        ],
      },
      {
        id: 'S1792152427909',
        createdAt: '2026-10-16T12:07:07.000Z',
        businessDate: '2026-10-16',
        keepAmountsWhenExists: true,
        expectedTotal: 985.02,
        lines: [
          { code: 'CAA039', qty: 1, unitPrice: 345 },
          { code: 'EAA022', qty: 1, unitPrice: 103.01 },
          { code: 'SAA069', qty: 1, unitPrice: 130.01 },
          { code: 'SBC053', qty: 1, unitPrice: 407 },
        ],
      },
      {
        id: 'S1792152162144',
        createdAt: '2026-10-16T12:02:42.000Z',
        businessDate: '2026-10-16',
        keepAmountsWhenExists: true,
        expectedTotal: 345,
        lines: [{ code: 'CAA039', qty: 1, unitPrice: 345 }],
      },
      {
        id: 'S1792152109074',
        createdAt: '2026-10-16T12:01:49.000Z',
        businessDate: '2026-10-16',
        keepAmountsWhenExists: true,
        expectedTotal: 829.02,
        lines: [
          { code: 'LGI019', qty: 1, unitPrice: 248 },
          { code: 'FPA151', qty: 1, unitPrice: 436.01 },
          { code: 'ASB046', qty: 1, unitPrice: 145.01 },
        ],
      },
      {
        id: 'S1792154637488',
        createdAt: '2026-10-16T12:43:57.000Z',
        businessDate: '2026-10-16',
        paymentMethod: 'transfer',
        paymentNote: 'Fiş düzeltmesi: havale 1.091,03 ₺ (termal fiş — kasa listesinde eksikti)',
        keepAmountsWhenExists: true,
        expectedTotal: 1091.03,
        lines: [
          { code: 'CBA052', qty: 1, unitPrice: 211.01 },
          { code: 'DAA109', qty: 1, unitPrice: 220.01 },
          { code: 'DAA108', qty: 1, unitPrice: 241.01 },
          { code: 'CAA039', qty: 1, unitPrice: 345 },
          { code: 'ASF066', qty: 1, unitPrice: 74 },
        ],
      },
    ],
  },
];

const TARGET_TENANTS = new Set(['main']);

function buildItems(lines, priceFactor) {
  const items = [];
  for (const line of lines) {
    const productId = resolveProductId(line.code);
    if (!productId) {
      throw new Error(`Ürün kodu eşleşmedi: ${line.code}`);
    }
    items.push({
      productId,
      quantity: line.qty,
      priceType: 'our',
      unitPrice: round2(line.unitPrice * priceFactor),
    });
  }
  return items;
}

function saleTotal(items) {
  return round2(items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0));
}

function itemsSignature(items) {
  return JSON.stringify(
    (items ?? [])
      .map((i) => [i.productId, i.quantity, i.unitPrice, i.priceType])
      .sort((a, b) => a[0] - b[0]),
  );
}

function resolvePaymentMethod(def) {
  return def?.paymentMethod === 'transfer' ? 'transfer' : 'cash';
}

function applyCashPayment(sale, def, batchLabel) {
  const subtotal = saleTotal(sale.items ?? []);
  const extraDiscount = round2(Math.max(0, def?.additionalDiscountTl ?? 0));
  let total = round2(Math.max(0, subtotal - extraDiscount));
  if (def?.expectedTotal != null && Math.abs(total - def.expectedTotal) > 0.02) {
    total = round2(def.expectedTotal);
  }
  const method = resolvePaymentMethod(def);
  const noteParts = [def?.paymentNote ?? batchLabel];
  if (extraDiscount > 0) {
    noteParts.push(`+ ${extraDiscount} ₺ ek indirim`);
  }
  return {
    ...sale,
    items: sale.items,
    total,
    crmDiscountTotal: extraDiscount > 0 ? extraDiscount : sale.crmDiscountTotal,
    paymentMethod: method,
    paymentSplits: undefined,
    cashTendered: method === 'cash' ? total : undefined,
    changeGiven: method === 'cash' ? 0 : undefined,
    status: sale.status ?? 'completed',
    saleKind: sale.saleKind ?? 'sale',
    paymentCorrectedAt: new Date().toISOString(),
    paymentCorrectionNote: noteParts.join(' — '),
  };
}

function applyPaymentPreserveAmount(sale, def, batchLabel) {
  const method = resolvePaymentMethod(def);
  const total = round2(Number(sale.total) || saleTotal(sale.items ?? []));
  return {
    ...sale,
    total,
    paymentMethod: method,
    paymentSplits: undefined,
    cashTendered: method === 'cash' ? total : undefined,
    changeGiven: method === 'cash' ? 0 : undefined,
    paymentCorrectedAt: new Date().toISOString(),
    paymentCorrectionNote: def?.paymentNote ?? batchLabel,
  };
}

function buildSaleFromReceipt(def, existingId, priceFactor, batchLabel) {
  const items = buildItems(def.lines, priceFactor);
  return applyCashPayment(
    {
      id: existingId ?? def.id,
      items,
      businessDate: def.businessDate,
      createdAt: def.createdAt,
    },
    { ...def, priceFactor },
    batchLabel,
  );
}

function findSaleIndex(sales, def) {
  const ids = new Set([def.id, ...(def.altIds ?? [])]);
  return sales.findIndex((s) => ids.has(String(s.id)));
}

function saleNeedsUpdate(before, after) {
  if (before.paymentMethod !== after.paymentMethod) return true;
  if (before.paymentSplits) return true;
  if (Math.abs(Number(before.total) - Number(after.total)) > 0.01) return true;
  if (itemsSignature(before.items) !== itemsSignature(after.items)) return true;
  if (before.paymentCorrectionNote !== after.paymentCorrectionNote) return true;
  return false;
}

function migrateStore(snapshot) {
  const sales = [...(snapshot.sales ?? [])];
  let changed = false;
  const report = [];

  for (const batch of RECEIPT_BATCHES) {
    for (const def of batch.sales) {
      const idx = findSaleIndex(sales, def);
      const existingId = idx >= 0 ? String(sales[idx].id) : def.id;
      const rebuilt = def.keepAmountsWhenExists && idx >= 0
        ? applyPaymentPreserveAmount(sales[idx], def, `Fiş düzeltmesi: ${batch.label}`)
        : buildSaleFromReceipt(def, existingId, batch.priceFactor, `Fiş düzeltmesi: ${batch.label}`);

      if (idx >= 0) {
        if (
          saleNeedsUpdate(sales[idx], rebuilt)
          || Number(sales[idx].crmDiscountTotal ?? 0) !== Number(rebuilt.crmDiscountTotal ?? 0)
        ) {
          sales[idx] = rebuilt;
          changed = true;
          report.push(`  güncellendi: ${existingId} toplam ${rebuilt.total} ₺ (${batch.label})`);
        } else {
          report.push(`  uyumlu: ${existingId} (${rebuilt.total} ₺)`);
        }
        continue;
      }

      sales.push(rebuilt);
      changed = true;
      report.push(`  eklendi: ${def.id} toplam ${rebuilt.total} ₺ (${batch.label})`);
    }
  }

  if (!changed) return { snapshot, changed: false, report };

  return {
    snapshot: {
      ...snapshot,
      sales: sales.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      updatedAt: new Date().toISOString(),
    },
    changed: true,
    report,
  };
}

async function migrateTenant(dataDir, tenantId) {
  if (!TARGET_TENANTS.has(tenantId)) return;
  const snapshot = await readTenantStore(dataDir, tenantId);
  const { snapshot: next, changed, report } = migrateStore(snapshot);
  if (!changed) {
    console.log(`  ${tenantId}: değişiklik yok`);
    return;
  }
  await writeTenantStore(dataDir, tenantId, next);
  console.log(`  ${tenantId}:`);
  for (const line of report) console.log(line);
}

async function main() {
  const dataDir = process.argv[2] || join(process.cwd(), 'data');
  console.log(`==> Fiş satış düzeltmeleri: ${dataDir}`);
  await migrateTenant(dataDir, 'main');

  const tenantsDir = join(dataDir, 'tenants');
  try {
    const entries = await readdir(tenantsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        await migrateTenant(dataDir, entry.name);
      }
    }
  } catch {
    /* no tenants */
  }
  console.log('==> Bitti');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
