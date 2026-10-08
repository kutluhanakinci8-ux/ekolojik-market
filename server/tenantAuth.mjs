import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createDefaultPostaOnboarding } from './postaOnboarding.mjs';
import { defaultAliasesForDomain } from './postaDeliverability.mjs';

const DEFAULT_SETTINGS = {
  businessName: 'Ekolojik Market',
  lowStockThreshold: 10,
  defaultPriceType: 'partner',
  posNotes: { displayDurationSec: 8, repeatIntervalMin: 1, items: [] },
  currency: {
    baseCurrency: 'TRY',
    displayCurrency: 'TRY',
    autoSource: 'tcmb',
    rateSide: 'sell',
    rates: {
      USD: { currency: 'USD', rateToTry: 34.5, buyRate: 34.5, sellRate: 34.5, source: 'manual', updatedAt: new Date().toISOString(), isManualOverride: true },
      KZT: { currency: 'KZT', rateToTry: 0.065, buyRate: 0.065, sellRate: 0.065, source: 'manual', updatedAt: new Date().toISOString(), isManualOverride: true },
    },
    vakifbank: { enabled: false },
  },
  dashboardWidgets: {
    payment: true,
    topProducts: true,
    stockAlerts: true,
    recentSales: true,
    userActivity: true,
    paymentCalendar: true,
    crmSummary: true,
  },
  paymentReminders: [],
  utilityBillSubscriptions: [],
  utilityBillAutoSync: { enabled: false, intervalHours: 24 },
  billEmailIngestion: { enabled: false },
  soleProprietorshipTaxCalendar: { enabled: false },
};

function hashPassword(password) {
  return createHash('sha256').update(password).digest('hex');
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || `tenant-${Date.now()}`;
}

function tenantStorePath(dataDir, tenantId) {
  if (!tenantId || tenantId === 'main') {
    return join(dataDir, 'store.json');
  }
  return join(dataDir, 'tenants', tenantId, 'store.json');
}

export async function readTenantStore(dataDir, tenantId) {
  const path = tenantStorePath(dataDir, tenantId);
  try {
    const raw = await readFile(path, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeTenantStore(dataDir, tenantId, data) {
  const path = tenantStorePath(dataDir, tenantId);
  await mkdir(join(path, '..'), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), 'utf8');
}

export async function listTenantIds(dataDir) {
  const tenantsDir = join(dataDir, 'tenants');
  try {
    const { readdir } = await import('node:fs/promises');
    const entries = await readdir(tenantsDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

function createInitialStore({ businessName, adminName, username, passwordHash, email, phone, plan }) {
  const now = new Date().toISOString();
  const userId = `U${Date.now()}`;
  const mailDomain = email.includes('@') ? email.split('@')[1].trim().toLowerCase() : '';

  return {
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
      ...DEFAULT_SETTINGS,
      businessName,
      tenantMeta: { email, phone, plan, trialEndsAt: new Date(Date.now() + 14 * 86400000).toISOString() },
      postaOnboarding: createDefaultPostaOnboarding(email),
      postaAliases: defaultAliasesForDomain(mailDomain),
    },
    priceType: 'partner',
    users: [
      {
        id: userId,
        username,
        displayName: adminName,
        passwordHash,
        role: 'admin',
        allowedTabs: [
          'dashboard',
          'sales',
          'stock',
          'reports',
          'accounting',
          'transactions',
          'customers',
          'cashier',
          'posta',
          'settings',
        ],
        isActive: true,
        isPrimaryAdmin: true,
        mustChangePassword: false,
        totpEnabled: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
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
}

export async function registerTenant(dataDir, payload) {
  const businessName = String(payload.businessName ?? '').trim();
  const email = String(payload.email ?? '').trim().toLowerCase();
  const phone = String(payload.phone ?? '').trim();
  const adminName = String(payload.adminName ?? '').trim();
  const username = String(payload.username ?? '').trim().toLowerCase();
  const password = String(payload.password ?? '');
  const plan = String(payload.plan ?? 'trial');

  if (!businessName || !email || !adminName || !username || password.length < 6) {
    return { ok: false, message: 'Tüm zorunlu alanları doldurun. Şifre en az 6 karakter olmalı.' };
  }

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return { ok: false, message: 'Kullanıcı adı 3-32 karakter, harf/rakam/nokta/alt çizgi olabilir.' };
  }

  let tenantId = slugify(businessName);
  const existingTenants = await listTenantIds(dataDir);
  if (existingTenants.includes(tenantId)) {
    tenantId = `${tenantId}-${Date.now().toString(36).slice(-4)}`;
  }

  const mainStore = await readTenantStore(dataDir, 'main');
  const mainUsers = mainStore?.users ?? [];
  if (mainUsers.some((u) => u.username === username)) {
    return { ok: false, message: 'Bu kullanıcı adı zaten kullanılıyor.' };
  }

  for (const tid of existingTenants) {
    const store = await readTenantStore(dataDir, tid);
    if (store?.users?.some((u) => u.username === username)) {
      return { ok: false, message: 'Bu kullanıcı adı zaten kullanılıyor.' };
    }
  }

  const passwordHash = hashPassword(password);
  const store = createInitialStore({
    businessName,
    adminName,
    username,
    passwordHash,
    email,
    phone,
    plan,
  });

  await writeTenantStore(dataDir, tenantId, store);

  const registrationsPath = join(dataDir, 'registrations.json');
  let registrations = [];
  try {
    registrations = JSON.parse(await readFile(registrationsPath, 'utf8'));
  } catch {
    registrations = [];
  }
  registrations.unshift({
    tenantId,
    businessName,
    email,
    phone,
    adminName,
    username,
    plan,
    createdAt: new Date().toISOString(),
  });
  await writeFile(registrationsPath, JSON.stringify(registrations, null, 2), 'utf8');

  return {
    ok: true,
    tenantId,
    username,
    message: 'Hesap oluşturuldu. İlk girişte Posta kurulum sihirbazı açılacaktır.',
    postaOnboardingStatus: store.settings?.postaOnboarding?.status ?? 'pending',
    registrationEmail: store.settings?.postaOnboarding?.registrationEmail ?? email,
  };
}

export async function saveContactMessage(dataDir, payload) {
  const name = String(payload.name ?? '').trim();
  const email = String(payload.email ?? '').trim();
  const subject = String(payload.subject ?? 'genel').trim();
  const message = String(payload.message ?? '').trim();

  if (!name || !email || !message) {
    return { ok: false, message: 'Ad, e-posta ve mesaj zorunludur.' };
  }

  const path = join(dataDir, 'contact-messages.json');
  let items = [];
  try {
    items = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    items = [];
  }
  const item = {
    id: `C${Date.now()}`,
    name,
    email,
    phone: String(payload.phone ?? '').trim(),
    subject,
    message,
    createdAt: new Date().toISOString(),
  };
  items.unshift(item);
  await writeFile(path, JSON.stringify(items, null, 2), 'utf8');
  return { ok: true, message: 'Mesajınız alındı. En kısa sürede dönüş yapacağız.', contact: item };
}

export async function listContactMessages(dataDir, limit = 50) {
  const path = join(dataDir, 'contact-messages.json');
  let items = [];
  try {
    items = JSON.parse(await readFile(path, 'utf8'));
  } catch {
    items = [];
  }
  if (!Array.isArray(items)) items = [];
  const max = Math.min(Math.max(Number(limit) || 50, 1), 200);
  return items.slice(0, max);
}

async function readContactItems(dataDir) {
  const path = join(dataDir, 'contact-messages.json');
  try {
    const items = JSON.parse(await readFile(path, 'utf8'));
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function writeContactItems(dataDir, items) {
  const path = join(dataDir, 'contact-messages.json');
  await writeFile(path, JSON.stringify(items, null, 2), 'utf8');
}

export async function markContactMessageRead(dataDir, contactId) {
  const items = await readContactItems(dataDir);
  const idx = items.findIndex((r) => r.id === contactId);
  if (idx < 0) return { ok: false, error: 'İletişim kaydı bulunamadı' };
  items[idx].readAt = new Date().toISOString();
  await writeContactItems(dataDir, items);
  return { ok: true };
}

export async function archiveContactMessage(dataDir, contactId) {
  const items = await readContactItems(dataDir);
  const idx = items.findIndex((r) => r.id === contactId);
  if (idx < 0) return { ok: false, error: 'İletişim kaydı bulunamadı' };
  items[idx].archivedAt = new Date().toISOString();
  await writeContactItems(dataDir, items);
  return { ok: true };
}
