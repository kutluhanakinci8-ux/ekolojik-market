#!/usr/bin/env node
/**
 * Tenant stok/satış verisini sıfırla; yönetici kullanıcıyı koru (POS Lite).
 *
 *   node scripts/reset-pos-lite-tenant.mjs --data-dir /var/www/market-pos/data --tenant lima-market --username limaadmin
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : '';
}

const dataDir = arg('data-dir') || join(process.cwd(), 'data');
const tenantId = arg('tenant');
const keepUsername = arg('username') || 'limaadmin';
const newPassword = arg('password');

if (!tenantId) {
  console.error('Zorunlu: --tenant');
  process.exit(1);
}

const path =
  tenantId === 'main' ? join(dataDir, 'store.json') : join(dataDir, 'tenants', tenantId, 'store.json');

const raw = await readFile(path, 'utf8');
const store = JSON.parse(raw);
const adminTabs = ['dashboard', 'sales', 'stock', 'reports', 'transactions', 'settings'];
const keep = (store.users ?? []).filter((u) => u.username === keepUsername);
if (keep.length === 0) {
  console.error(`Kullanıcı bulunamadı: ${keepUsername}`);
  process.exit(1);
}

if (newPassword && newPassword.length >= 6) {
  const passwordHash = createHash('sha256').update(newPassword).digest('hex');
  keep[0].passwordHash = passwordHash;
}

keep[0].allowedTabs = adminTabs;
keep[0].role = 'admin';
const now = new Date().toISOString();
keep[0].updatedAt = now;

const businessName = store.settings?.businessName ?? tenantId;

const clean = {
  updatedAt: now,
  products: [],
  productSets: [],
  sales: [],
  saleReturns: [],
  stockMovements: [],
  customers: [],
  expenses: [],
  cashHandovers: [],
  cashSessions: [],
  purchaseInvoices: [],
  settings: {
    ...store.settings,
    businessName,
    productProfile: 'pos-lite',
  },
  priceType: 'partner',
  users: keep,
  loginAuditLog: [],
  activityAuditLog: [],
  suppliers: [],
  customerLedger: [],
  supplierLedger: [],
  bankAccounts: [],
  bankTransactions: [],
  periodClosures: [],
  cashCountVariances: [],
  checkNotes: [],
  stockAdjustments: [],
  journalVouchers: [],
  equityPartners: [],
  capitalContributions: [],
};

await writeFile(path, JSON.stringify(clean, null, 2));
console.log(`OK   ${tenantId} sıfırlanı — ürün/satış 0, kullanıcı: ${keepUsername}`);
