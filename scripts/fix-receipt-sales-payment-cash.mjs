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
  ASF006: 'ASF066',
};

/** Fişteki liste fiyatının yarısı (fotoğraftaki el yazısı) */
const SALE_PRICE_FACTOR = 0.5;

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function resolveProductId(code) {
  const normalized = CODE_ALIASES[code] ?? code;
  return CODE_TO_PRODUCT_ID[normalized];
}

/** 16.10.2026 — unitPrice = termal fişteki brüt satır fiyatı (yarısı uygulanır) */
const RECEIPT_SALES = [
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
];

const TARGET_TENANTS = new Set(['main']);

function buildItems(lines) {
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
      unitPrice: round2(line.unitPrice * SALE_PRICE_FACTOR),
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

function applyCashPayment(sale) {
  const total = saleTotal(sale.items ?? []);
  return {
    ...sale,
    items: sale.items,
    total,
    paymentMethod: 'cash',
    paymentSplits: undefined,
    cashTendered: total,
    changeGiven: 0,
    status: sale.status ?? 'completed',
    saleKind: sale.saleKind ?? 'sale',
    paymentCorrectedAt: new Date().toISOString(),
    paymentCorrectionNote: 'Fiş düzeltmesi: %50 satış fiyatı, nakit',
  };
}

function buildSaleFromReceipt(def, existingId) {
  const items = buildItems(def.lines);
  return applyCashPayment({
    id: existingId ?? def.id,
    items,
    businessDate: def.businessDate,
    createdAt: def.createdAt,
  });
}

function findSaleIndex(sales, def) {
  const ids = new Set([def.id, ...(def.altIds ?? [])]);
  return sales.findIndex((s) => ids.has(String(s.id)));
}

function saleNeedsUpdate(before, after) {
  if (before.paymentMethod !== 'cash') return true;
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

  for (const def of RECEIPT_SALES) {
    const idx = findSaleIndex(sales, def);
    const existingId = idx >= 0 ? String(sales[idx].id) : def.id;
    const rebuilt = buildSaleFromReceipt(def, existingId);

    if (idx >= 0) {
      if (saleNeedsUpdate(sales[idx], rebuilt)) {
        sales[idx] = rebuilt;
        changed = true;
        report.push(`  güncellendi: ${existingId} toplam ${rebuilt.total} ₺ (%50, nakit)`);
      } else {
        report.push(`  uyumlu: ${existingId} (${rebuilt.total} ₺)`);
      }
      continue;
    }

    sales.push(rebuilt);
    changed = true;
    report.push(`  eklendi: ${def.id} toplam ${rebuilt.total} ₺ (%50, nakit)`);
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
  console.log(`==> Fiş satışları %50 + nakit: ${dataDir}`);
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
