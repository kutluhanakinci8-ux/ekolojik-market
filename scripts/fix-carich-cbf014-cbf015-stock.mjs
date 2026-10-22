#!/usr/bin/env node
/**
 * CARICH CBF015 (6955470951588) / CBF014 (6955470951571) barkod karışıklığı —
 * fiziksel stok: 21 ve 28. İsteğe bağlı satış düzeltmesi: FIX_CBF_SALE_LINES=1
 *
 * Kullanım: node scripts/fix-carich-cbf014-cbf015-stock.mjs [/var/www/market-pos/data]
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, writeTenantStore } from '../server/tenantAuth.mjs';

const PRODUCT_SHEA = 14; // CBF015 6955470951588
const PRODUCT_ALOE = 15; // CBF014 6955470951571
const TARGET_STOCK = { [PRODUCT_SHEA]: 21, [PRODUCT_ALOE]: 28 };

/** Satış satırı p14 → p15 (Aloe fiilen satılmış, Shea barkodu okunmuş) */
const SALE_LINE_MOVES = [
  { saleId: 'S1792151611448', fromProductId: PRODUCT_SHEA, quantity: 1 },
  { saleId: 'S1792151646521', fromProductId: PRODUCT_SHEA, quantity: 1 },
  { saleId: 'S1792226458319', fromProductId: PRODUCT_SHEA, quantity: 1 },
  { saleId: 'S1792231377551', fromProductId: PRODUCT_SHEA, quantity: 2 },
];

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

function productSnapshot(products, productId) {
  const p = products.find((item) => item.id === productId);
  if (!p) throw new Error(`Ürün bulunamadı: ${productId}`);
  return p;
}

function applySaleLineMove(store, { saleId, fromProductId, quantity }) {
  const sale = store.sales?.find((s) => s.id === saleId);
  if (!sale) {
    console.warn(`  Satış yok, atlandı: ${saleId}`);
    return 0;
  }
  let remaining = quantity;
  const fromItems = sale.items.filter((item) => item.productId === fromProductId);
  let moved = 0;
  for (const item of fromItems) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, item.quantity);
    item.quantity -= take;
    remaining -= take;
    moved += take;

    const target = productSnapshot(store.products, PRODUCT_ALOE);
    const existing = sale.items.find((item) => item.productId === PRODUCT_ALOE);
    if (existing) {
      existing.quantity += take;
    } else {
      sale.items.push({
        productId: PRODUCT_ALOE,
        name: target.name,
        quantity: take,
        unitPrice: item.unitPrice ?? target.fullSalePrice,
        lineTotal: round2((item.unitPrice ?? target.fullSalePrice) * take),
      });
    }
  }
  sale.items = sale.items.filter((item) => item.quantity > 0);
  for (const item of sale.items) {
    if (item.lineTotal == null && item.unitPrice != null) {
      item.lineTotal = round2(item.unitPrice * item.quantity);
    }
  }
  sale.total = round2(sale.items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0));
  return moved;
}

function retargetStockMovements(store, saleId, fromProductId, toProductId, quantity) {
  const movements = store.stockMovements ?? [];
  let remaining = quantity;
  for (const move of movements) {
    if (remaining <= 0) break;
    if (move.saleId !== saleId || move.productId !== fromProductId) continue;
    if (move.quantity <= remaining) {
      move.productId = toProductId;
      move.note = `${move.note ?? 'Satış'} — CBF014/CBF015 barkod düzeltmesi`;
      remaining -= move.quantity;
    }
  }
  if (remaining > 0) {
    console.warn(`  Hareket eşleşmedi (${saleId}): ${remaining} adet`);
  }
}

function dedupeLegacySaleMovements(store) {
  const movements = store.stockMovements ?? [];
  const reconcileKeys = new Set(
    movements
      .filter((m) => m.id?.startsWith('M-reconcile-') && m.saleId)
      .map((m) => `${m.saleId}:${m.productId}`),
  );
  const before = movements.length;
  store.stockMovements = movements.filter((m) => {
    if (!m.saleId || m.id?.startsWith('M-reconcile-')) return true;
    const key = `${m.saleId}:${m.productId}`;
    if (reconcileKeys.has(key) && /^M\d/.test(m.id ?? '')) return false;
    return true;
  });
  return before - store.stockMovements.length;
}

async function main() {
  const dataDir = process.argv[2] || join(process.cwd(), 'data');
  const store = await readTenantStore(dataDir, 'main');
  if (!store?.products) {
    console.error('store.json okunamadı');
    process.exit(1);
  }

  const backupDir = join(dataDir, 'backups', 'manual-fixes');
  await mkdir(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const storePath = join(dataDir, 'store.json');
  await copyFile(storePath, join(backupDir, `store-before-cbf014-015-${stamp}.json`));

  const before14 = productSnapshot(store.products, PRODUCT_SHEA).stock;
  const before15 = productSnapshot(store.products, PRODUCT_ALOE).stock;
  console.log(`Önce: CBF015 (id ${PRODUCT_SHEA}) stok=${before14}, CBF014 (id ${PRODUCT_ALOE}) stok=${before15}`);

  let totalMoved = 0;
  if (process.env.FIX_CBF_SALE_LINES === '1') {
    for (const move of SALE_LINE_MOVES) {
      const moved = applySaleLineMove(store, move);
      if (moved > 0) {
        retargetStockMovements(store, move.saleId, move.fromProductId, PRODUCT_ALOE, moved);
        totalMoved += moved;
        console.log(`  Satış ${move.saleId}: ${moved} adet p${move.fromProductId} → p${PRODUCT_ALOE}`);
      }
    }
    console.log(`Satış satırı toplam taşındı: ${totalMoved}`);
  } else {
    console.log('Satış satırları değiştirilmedi (FIX_CBF_SALE_LINES=1 ile açılır)');
  }

  const removed = dedupeLegacySaleMovements(store);
  console.log(`Çift stok hareketi temizlendi: ${removed}`);

  for (const [productId, stock] of Object.entries(TARGET_STOCK)) {
    const product = productSnapshot(store.products, Number(productId));
    const prev = product.stock;
    product.stock = stock;
    const delta = stock - prev;
    const now = new Date().toISOString();
    store.stockMovements = store.stockMovements ?? [];
    store.stockMovements.push({
      id: `M-fix-cbf014-015-${productId}-${Date.now()}`,
      productId: Number(productId),
      type: delta >= 0 ? 'in' : 'out',
      quantity: Math.abs(delta),
      note: 'CBF014/CBF015 barkod karışıklığı — fiziksel sayım düzeltmesi (6955470951588=21, 6955470951571=28)',
      createdAt: now,
    });
  }

  store.updatedAt = new Date().toISOString();
  await writeTenantStore(dataDir, 'main', store);

  const after14 = productSnapshot(store.products, PRODUCT_SHEA).stock;
  const after15 = productSnapshot(store.products, PRODUCT_ALOE).stock;
  console.log(`Sonra: CBF015 stok=${after14}, CBF014 stok=${after15}`);
  console.log('Kaydedildi:', storePath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
