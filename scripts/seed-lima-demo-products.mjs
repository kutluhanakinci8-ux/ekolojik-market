#!/usr/bin/env node
/**
 * Lima Market (POS Lite) — 4 deneme ürünü
 *   node scripts/seed-lima-demo-products.mjs --data-dir /var/www/market-pos/data
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'lima-market';
const path =
  tenant === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', tenant, 'store.json');

/** Lima deneme seti — barkodları satış ekranında manuel girilebilir */
const DEMO_PRODUCTS = [
  {
    id: 1001,
    productCode: 'LIMA-001',
    barcode: '8690631000001',
    name: 'Organik Zeytinyağı 500 ml',
    category: 'temizlik',
    pv: 1,
    purchasePrice: 85,
    partnerPrice: 120,
    fullSalePrice: 149.9,
    ourPercent: 0,
    ourPriceWithVat: 149.9,
    partnerPriceWithVat: 120,
    boxDimensions: '-',
    weightKg: 0.5,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 40,
    isSample: false,
    sampleStock: 0,
  },
  {
    id: 1002,
    productCode: 'LIMA-002',
    barcode: '8690631000002',
    name: 'Tam Buğday Ekmeği',
    category: 'temizlik',
    pv: 0.5,
    purchasePrice: 12,
    partnerPrice: 18,
    fullSalePrice: 24.9,
    ourPercent: 0,
    ourPriceWithVat: 24.9,
    partnerPriceWithVat: 18,
    boxDimensions: '-',
    weightKg: 0.4,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 60,
    isSample: false,
    sampleStock: 0,
  },
  {
    id: 1003,
    productCode: 'LIMA-003',
    barcode: '8690631000003',
    name: 'Süt 1 L (tam yağlı)',
    category: 'temizlik',
    pv: 0.5,
    purchasePrice: 28,
    partnerPrice: 35,
    fullSalePrice: 42.5,
    ourPercent: 0,
    ourPriceWithVat: 42.5,
    partnerPriceWithVat: 35,
    boxDimensions: '-',
    weightKg: 1,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 48,
    isSample: false,
    sampleStock: 0,
  },
  {
    id: 1004,
    productCode: 'LIMA-004',
    barcode: '8690631000004',
    name: 'Çiçek Balı 250 g',
    category: 'temizlik',
    pv: 1.2,
    purchasePrice: 95,
    partnerPrice: 130,
    fullSalePrice: 165,
    ourPercent: 0,
    ourPriceWithVat: 165,
    partnerPriceWithVat: 130,
    boxDimensions: '-',
    weightKg: 0.25,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 25,
    isSample: false,
    sampleStock: 0,
  },
];

const raw = await readFile(path, 'utf8');
const store = JSON.parse(raw);
const now = new Date().toISOString();
store.products = DEMO_PRODUCTS;
store.updatedAt = now;
await writeFile(path, JSON.stringify(store, null, 2));

console.log(`OK   ${tenant}: ${DEMO_PRODUCTS.length} deneme ürünü yazıldı`);
for (const p of DEMO_PRODUCTS) {
  console.log(`     ${p.barcode}  ${p.name}  stok=${p.stock}  satış=${p.fullSalePrice} ₺`);
}
