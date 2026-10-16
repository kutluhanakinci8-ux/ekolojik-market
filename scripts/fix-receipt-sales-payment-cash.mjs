#!/usr/bin/env node
/**
 * Fotoğraftaki fişler — ödeme kart → nakit (sunucu store.json).
 * Satış yoksa fiş satırlarından ekler (stok dokunulmaz; kasa raporu için).
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

/** Fiş OCR / yazım varyantları */
const CODE_ALIASES = {
  LG1019: 'LGI019',
  ASF006: 'ASF066',
};

function resolveProductId(code) {
  const normalized = CODE_ALIASES[code] ?? code;
  return CODE_TO_PRODUCT_ID[normalized];
}

/** 16.10.2026 Greenleaf fişleri (sale id = fiş no) */
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

const CORRECTION_AT = new Date().toISOString();

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
      unitPrice: line.unitPrice,
    });
  }
  return items;
}

function saleTotal(items) {
  return Math.round(items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) * 100) / 100;
}

function applyCashPayment(sale) {
  const total = Number(sale.total) || saleTotal(sale.items ?? []);
  return {
    ...sale,
    total,
    paymentMethod: 'cash',
    paymentSplits: undefined,
    cashTendered: total,
    changeGiven: 0,
    status: sale.status ?? 'completed',
    saleKind: sale.saleKind ?? 'sale',
    paymentCorrectedAt: CORRECTION_AT,
    paymentCorrectionNote: 'Kart girişi → nakit (fiş düzeltmesi)',
  };
}

function buildSaleFromReceipt(def) {
  const items = buildItems(def.lines);
  const total = saleTotal(items);
  return applyCashPayment({
    id: def.id,
    items,
    total,
    businessDate: def.businessDate,
    createdAt: def.createdAt,
  });
}

function findSaleIndex(sales, def) {
  const ids = new Set([def.id, ...(def.altIds ?? [])]);
  return sales.findIndex((s) => ids.has(String(s.id)));
}

function migrateStore(snapshot) {
  const sales = [...(snapshot.sales ?? [])];
  let changed = false;
  const report = [];

  for (const def of RECEIPT_SALES) {
    const idx = findSaleIndex(sales, def);
    if (idx >= 0) {
      const before = sales[idx];
      const next = applyCashPayment(before);
      if (
        before.paymentMethod !== 'cash'
        || before.paymentSplits
        || before.paymentCorrectedAt !== next.paymentCorrectedAt
      ) {
        sales[idx] = next;
        changed = true;
        report.push(`  güncellendi: ${def.id} (kart→nakit)`);
      } else {
        report.push(`  zaten nakit: ${def.id}`);
      }
      continue;
    }

    const built = buildSaleFromReceipt(def);
    sales.push(built);
    changed = true;
    report.push(`  eklendi: ${def.id} toplam ${built.total} ₺ (nakit)`);
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
  console.log(`==> Fiş satışları nakit düzeltmesi: ${dataDir}`);
  await migrateTenant(dataDir, 'main');

  const tenantsDir = join(dataDir, 'tenants');
  try {
    const entries = await readdir(tenantsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'main') {
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
