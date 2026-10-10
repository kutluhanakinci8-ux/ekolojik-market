#!/usr/bin/env node
/**
 * Lima Market — 4 özgün stok (Greenleaf’ten bağımsız, fotoğraflı)
 *
 *   node scripts/seed-lima-demo-products.mjs --data-dir /var/www/market-pos/data
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'lima-market';
const path =
  tenant === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', tenant, 'store.json');

/** Lima Market kendi kataloğu — id 1001+ main seed ile çakışmaz */
const LIMA_PRODUCTS = [
  {
    id: 1001,
    productCode: 'LIMA-LM01',
    barcode: '8695551001001',
    name: 'Lima Limon Aromalı Duş Jeli',
    category: 'limo',
    pv: 0.5,
    purchasePrice: 42,
    partnerPrice: 58,
    fullSalePrice: 89.9,
    ourPercent: 0,
    ourPriceWithVat: 89.9,
    partnerPriceWithVat: 58,
    boxDimensions: '40×25×15 cm',
    weightKg: 0.52,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 36,
    isSample: false,
    sampleStock: 0,
    imageUrl: '/product-images/lima-1001.svg',
  },
  {
    id: 1002,
    productCode: 'LIMA-LM02',
    barcode: '8695551001002',
    name: 'Lima Lavanta Duş Jeli',
    category: 'limo',
    pv: 0.5,
    purchasePrice: 44,
    partnerPrice: 60,
    fullSalePrice: 92.9,
    ourPercent: 0,
    ourPriceWithVat: 92.9,
    partnerPriceWithVat: 60,
    boxDimensions: '40×25×15 cm',
    weightKg: 0.52,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 42,
    isSample: false,
    sampleStock: 0,
    imageUrl: '/product-images/lima-1002.svg',
  },
  {
    id: 1003,
    productCode: 'LIMA-LM03',
    barcode: '8695551001003',
    name: 'Lima Argan Özlü Saç Şampuanı',
    category: 'limo',
    pv: 0.7,
    purchasePrice: 55,
    partnerPrice: 72,
    fullSalePrice: 109.9,
    ourPercent: 0,
    ourPriceWithVat: 109.9,
    partnerPriceWithVat: 72,
    boxDimensions: '35×20×12 cm',
    weightKg: 0.41,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 28,
    isSample: false,
    sampleStock: 0,
    imageUrl: '/product-images/lima-1003.svg',
  },
  {
    id: 1004,
    productCode: 'LIMA-LM04',
    barcode: '8695551001004',
    name: 'Lima Aloe Vücut Losyonu',
    category: 'limo',
    pv: 0.6,
    purchasePrice: 48,
    partnerPrice: 65,
    fullSalePrice: 99.9,
    ourPercent: 0,
    ourPriceWithVat: 99.9,
    partnerPriceWithVat: 65,
    boxDimensions: '30×18×8 cm',
    weightKg: 0.28,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: 31,
    isSample: false,
    sampleStock: 0,
    imageUrl: '/product-images/lima-1004.svg',
  },
];

let store;
try {
  const raw = await readFile(path, 'utf8');
  store = JSON.parse(raw);
} catch (err) {
  if (err?.code === 'ENOENT') {
    await mkdir(dirname(path), { recursive: true });
    store = {
      updatedAt: new Date().toISOString(),
      products: [],
      productSets: [],
      sales: [],
      users: [],
      settings: { businessName: 'Lima Market', productProfile: 'pos-lite', lowStockThreshold: 10 },
    };
  } else {
    throw err;
  }
}

const now = new Date().toISOString();
const movements = LIMA_PRODUCTS.map((p) => ({
  id: `M-seed-${p.id}`,
  productId: p.id,
  productName: p.name,
  type: 'in',
  quantity: p.stock,
  previousStock: 0,
  newStock: p.stock,
  note: 'Lima başlangıç stok girişi',
  createdAt: now,
}));
store.products = LIMA_PRODUCTS;
store.stockMovements = [...movements, ...(store.stockMovements ?? [])].slice(0, 500);
store.productSets = store.productSets ?? [];
store.settings = {
  ...store.settings,
  businessName: store.settings?.businessName?.trim() || 'Lima Market',
  productProfile: 'pos-lite',
  lowStockThreshold: store.settings?.lowStockThreshold ?? 10,
};
store.updatedAt = now;

await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(store, null, 2));

console.log(`OK   ${tenant}: ${LIMA_PRODUCTS.length} Lima ürünü (fotoğraflı) yazıldı → ${path}`);
for (const p of LIMA_PRODUCTS) {
  console.log(`     ${p.barcode}  ${p.name}  stok=${p.stock}  ${p.fullSalePrice} ₺  ${p.imageUrl}`);
}
console.log('');
console.log('Tarayıcıda: çıkış → giriş (mağaza: lima-market) → Ctrl+Shift+R');
