#!/usr/bin/env node
/**
 * Lima Market — 4 özgün stok (Greenleaf’ten bağımsız, fotoğraflı, tam fiyat)
 *
 *   node scripts/seed-lima-demo-products.mjs --data-dir /var/www/market-pos/data
 *
 * UYARI: Üretimde çalıştırmayın — mevcut lima-market store.json üzerine yazır.
 * Demo referans: backups/seeds/lima-market.demo-store.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VAT = 1.2;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function wholesaleFromRetailNet(retailNet) {
  return {
    qty10: round2(retailNet * 0.92),
    qty20: round2(retailNet * 0.87),
    qty50: round2(retailNet * 0.82),
    qty100: round2(retailNet * 0.76),
  };
}

function limaProduct(base) {
  const purchasePrice = base.purchasePrice;
  const partnerPrice = base.partnerPrice;
  /** base.fullSalePrice = perakende (KDV hariç); Lima kasa da bu liste ile çalışır */
  const fullSalePrice = base.fullSalePrice;
  const couponPrice = base.couponPrice ?? round2(partnerPrice * 1.05);
  const ourPercent = round2(((fullSalePrice - purchasePrice) / purchasePrice) * 100);
  return {
    ...base,
    couponPrice,
    ourPercent,
    ourPriceWithVat: fullSalePrice,
    partnerPriceWithVat: round2(partnerPrice * VAT),
    wholesalePrices: wholesaleFromRetailNet(fullSalePrice),
    boxDimensions: base.boxDimensions ?? '40×25×15 cm',
    weightKg: base.weightKg ?? 0.5,
    desi: 1,
    cargoPerUnit: 0,
    suratTotal: 0,
    arasTotal: 0,
    yurticiTotal: 0,
    stock: base.stock ?? 4,
    isSample: false,
    sampleStock: 0,
  };
}

function limaImagePath(productId) {
  return `/product-images/lima-${productId}.svg`;
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenant = arg('tenant') || 'lima-market';
const path =
  tenant === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', tenant, 'store.json');

const LIMA_PRODUCTS = [
  limaProduct({
    id: 1001,
    productCode: 'LIMA-LM01',
    barcode: '8695551001001',
    name: 'Lima Limon Aromalı Duş Jeli',
    category: 'limo',
    pv: 0.5,
    purchasePrice: 42,
    partnerPrice: 58,
    fullSalePrice: 89.9,
    stock: 4,
  }),
  limaProduct({
    id: 1002,
    productCode: 'LIMA-LM02',
    barcode: '8695551001002',
    name: 'Lima Lavanta Duş Jeli',
    category: 'limo',
    pv: 0.5,
    purchasePrice: 44,
    partnerPrice: 60,
    fullSalePrice: 92.9,
    stock: 4,
  }),
  limaProduct({
    id: 1003,
    productCode: 'LIMA-LM03',
    barcode: '8695551001003',
    name: 'Lima Argan Özlü Saç Şampuanı',
    category: 'limo',
    pv: 0.7,
    purchasePrice: 55,
    partnerPrice: 72,
    fullSalePrice: 109.9,
    stock: 4,
  }),
  limaProduct({
    id: 1004,
    productCode: 'LIMA-LM04',
    barcode: '8695551001004',
    name: 'Lima Aloe Vücut Losyonu',
    category: 'limo',
    pv: 0.6,
    purchasePrice: 48,
    partnerPrice: 65,
    fullSalePrice: 99.9,
    weightKg: 0.28,
    boxDimensions: '30×18×8 cm',
    stock: 4,
  }),
];

for (const p of LIMA_PRODUCTS) {
  p.imageUrl = limaImagePath(p.id);
}

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
  id: `M-seed-${p.id}-${Date.now()}`,
  productId: p.id,
  productName: p.name,
  type: 'in',
  quantity: p.stock,
  previousStock: 0,
  newStock: p.stock,
  note: 'Lima başlangıç stok girişi (4 adet)',
  createdAt: now,
}));
store.products = LIMA_PRODUCTS;
store.stockMovements = [...movements, ...(store.stockMovements ?? [])].slice(0, 500);
store.productSets = [];
store.settings = {
  ...store.settings,
  businessName: store.settings?.businessName?.trim() || 'Lima Market',
  productProfile: 'pos-lite',
  lowStockThreshold: store.settings?.lowStockThreshold ?? 10,
};
store.updatedAt = now;

await mkdir(dirname(path), { recursive: true });
await writeFile(path, JSON.stringify(store, null, 2));

console.log(`OK   ${tenant}: ${LIMA_PRODUCTS.length} ürün — her biri stok=4, fotoğraf + tam fiyat`);
console.log(`     Dosya: ${path}`);
for (const p of LIMA_PRODUCTS) {
  console.log(
    `     ${p.productCode}  alış=${p.purchasePrice}  partner=${p.partnerPrice}  kupon=${p.couponPrice}  perakende=${p.fullSalePrice}  stok=${p.stock}`,
  );
}
console.log('');
console.log('Sonra: pm2 restart market-pos (gerekirse) → tarayıcı Ctrl+Shift+R');
