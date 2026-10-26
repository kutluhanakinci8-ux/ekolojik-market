#!/usr/bin/env node
/**
 * 25.10.2026 fiş S1792941529366 — fiş yazdırıldı ama store.json'da yok (receipt-print.log kanıtı).
 * Satışı ve stok hareketlerini geri ekler (fiziksel çıkış fiş ile uyumlu).
 *
 *   node scripts/restore-missing-sale-s1792941529366.mjs --data-dir /var/www/market-pos/data
 *   node scripts/restore-missing-sale-s1792941529366.mjs --dry-run
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SALE_ID = 'S1792941529366';
const CREATED_AT = '2026-10-25T15:18:49.366Z';
const BUSINESS_DATE = '2026-10-25';
const TOTAL = 1068.1;

/** Fiş satırları — KDV dahil birim fiyat */
const LINES = [
  { code: 'ASF054', qty: 1, unitPrice: 479.6 },
  { code: 'ASA086', qty: 1, unitPrice: 316.8 },
  { code: 'CBF014', qty: 2, unitPrice: 81.4 },
  { code: 'DAB089', qty: 1, unitPrice: 108.9 },
];

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dryRun = process.argv.includes('--dry-run');
const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'main';
const storePath =
  tenant === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', tenant, 'store.json');

function findProductByCode(products, code) {
  const c = code.trim().toUpperCase();
  return products.find(
    (p) =>
      String(p.productCode ?? '').toUpperCase() === c
      || String(p.barcode ?? '').toUpperCase() === c,
  );
}

function movementId(saleId, productId) {
  return `restore-${saleId}-${productId}`;
}

async function main() {
  const raw = await readFile(storePath, 'utf8');
  const store = JSON.parse(raw);
  const sales = store.sales ?? [];
  if (sales.some((s) => s.id === SALE_ID)) {
    console.log(`Satış zaten var: ${SALE_ID}`);
    return;
  }

  const items = [];
  const movements = [];
  const products = store.products ?? [];

  for (const line of LINES) {
    const product = findProductByCode(products, line.code);
    if (!product) {
      console.error(`Ürün bulunamadı: ${line.code}`);
      process.exit(1);
    }
    items.push({
      productId: product.id,
      quantity: line.qty,
      priceType: 'our',
      unitPrice: line.unitPrice,
    });
    const prevStock = product.stock ?? 0;
    const newStock = Math.max(0, prevStock - line.qty);
    movements.push({
      id: movementId(SALE_ID, product.id),
      productId: product.id,
      productName: product.name,
      type: 'sale',
      quantity: line.qty,
      previousStock: prevStock,
      newStock,
      note: `Satış (geri yükleme ${SALE_ID})`,
      saleId: SALE_ID,
      createdAt: CREATED_AT,
    });
    product.stock = newStock;
  }

  const sale = {
    id: SALE_ID,
    items,
    total: TOTAL,
    saleKind: 'sale',
    paymentMethod: 'card',
    businessDate: BUSINESS_DATE,
    createdAt: CREATED_AT,
  };

  store.sales = [sale, ...sales];
  store.stockMovements = [...movements, ...(store.stockMovements ?? [])];
  store.updatedAt = new Date().toISOString();

  console.log('Eklenecek satış:', SALE_ID, TOTAL, '₺', items.length, 'kalem');
  console.log('Stok hareketi:', movements.length);

  if (dryRun) {
    console.log('(dry-run — dosya yazılmadı)');
    return;
  }

  const backupDir = join(dataDir, 'data-backups');
  await mkdir(backupDir, { recursive: true });
  const stamp = store.updatedAt.replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `pre-restore-${SALE_ID}-${stamp}.json`);
  await copyFile(storePath, backupPath);
  await writeFile(storePath, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  console.log(`Yedek: ${backupPath}`);
  console.log('store.json güncellendi.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
