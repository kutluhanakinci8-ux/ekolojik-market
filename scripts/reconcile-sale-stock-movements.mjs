#!/usr/bin/env node
/**
 * Geçmiş satışlar için eksik stok düşümü + hareket fişi (idempotent).
 * Kullanım: node scripts/reconcile-sale-stock-movements.mjs [/var/www/market-pos/data]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function movementKey(saleId, productId) {
  return `${saleId}::p${productId}`;
}

function createSaleMovement(product, saleId, quantity, previousStock, newStock) {
  return {
    id: `M-reconcile-${saleId}-${product.id}-${Math.random().toString(36).slice(2, 7)}`,
    productId: product.id,
    productName: product.name,
    type: 'sale',
    quantity,
    previousStock,
    newStock,
    note: `Satış (geçmiş düzeltme) — ${saleId}`,
    saleId,
    createdAt: new Date().toISOString(),
  };
}

async function main() {
  const dataDir = process.argv[2] || join(process.cwd(), 'data');
  const storePath = join(dataDir, 'store.json');
  const raw = JSON.parse(await readFile(storePath, 'utf8'));
  const sales = [...(raw.sales ?? [])].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
  const movements = [...(raw.stockMovements ?? [])];
  const indexed = new Set(
    movements
      .filter((m) => m.saleId && m.productId)
      .map((m) => movementKey(m.saleId, m.productId)),
  );

  const products = [...(raw.products ?? [])];
  const byId = new Map(products.map((p) => [Number(p.id), { ...p }]));

  let addedMovements = 0;
  let adjustedLines = 0;

  for (const sale of sales) {
    if (sale.status && sale.status !== 'completed') continue;
    const items = sale.items ?? [];
    const qtyByProduct = new Map();
    for (const item of items) {
      if (item.priceType === 'sample') continue;
      const pid = Number(item.productId);
      if (!pid) continue;
      qtyByProduct.set(pid, (qtyByProduct.get(pid) ?? 0) + Number(item.quantity) || 0);
    }
    for (const [productId, qty] of qtyByProduct) {
      if (qty <= 0) continue;
      const key = movementKey(sale.id, productId);
      if (indexed.has(key)) continue;
      const product = byId.get(productId);
      if (!product) continue;
      const prev = Number(product.stock) || 0;
      const next = Math.max(0, prev - qty);
      movements.unshift(createSaleMovement(product, sale.id, qty, prev, next));
      product.stock = next;
      indexed.add(key);
      addedMovements += 1;
      adjustedLines += 1;
    }
  }

  if (addedMovements === 0) {
    console.log('Eksik satış hareketi yok — değişiklik yapılmadı.');
    return;
  }

  const nextStore = {
    ...raw,
    products: [...byId.values()],
    stockMovements: movements,
    updatedAt: new Date().toISOString(),
  };
  await writeFile(storePath, JSON.stringify(nextStore, null, 2), 'utf8');
  console.log(`Tamam: ${adjustedLines} satış satırı için hareket eklendi, stok güncellendi.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
