import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  summarizeReceivables,
  summarizePaymentObligations,
  buildTenantPlatformAlerts,
  buildMergedCalendarItems,
  todayKey,
} from './platformTenantMetrics.mjs';

function summarizeStore(store) {
  const products = Array.isArray(store?.products) ? store.products : [];
  const sales = Array.isArray(store?.sales) ? store.sales : [];
  const users = Array.isArray(store?.users) ? store.users : [];
  const threshold = Number(store?.settings?.lowStockThreshold) || 10;
  const now = Date.now();
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  let recentSales = 0;
  let revenue30d = 0;
  for (const sale of sales) {
    const t = Date.parse(sale?.createdAt ?? sale?.date ?? '');
    if (!Number.isFinite(t) || t < monthAgo) continue;
    recentSales += 1;
    revenue30d += Number(sale?.total ?? sale?.grandTotal ?? 0) || 0;
  }
  const lowStock = products.filter((p) => (Number(p?.stock) || 0) <= threshold).length;
  const activeUsers = users.filter((u) => u.isActive !== false).length;
  const receivables = summarizeReceivables(store);
  const { topDebtors: _omitDebtors, ...receivableMetrics } = receivables;
  const paymentObligations = summarizePaymentObligations(store);
  return {
    businessName: String(store?.settings?.businessName ?? '').trim() || '—',
    productProfile: store?.settings?.productProfile ?? 'full',
    productCount: products.length,
    lowStockCount: lowStock,
    saleCount: sales.length,
    recentSaleCount30d: recentSales,
    revenue30dTry: Math.round(revenue30d * 100) / 100,
    activeUserCount: activeUsers,
    updatedAt: store?.updatedAt ?? null,
    ...receivableMetrics,
    ...paymentObligations,
  };
}

async function readRegistrations(dataDir) {
  try {
    const raw = JSON.parse(await readFile(join(dataDir, 'registrations.json'), 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export async function listPlatformTenants(dataDir) {
  const ids = ['main', ...await listTenantIds(dataDir)];
  const unique = [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
  const registrations = await readRegistrations(dataDir);
  const regByTenant = new Map(registrations.map((r) => [r.tenantId, r]));

  const tenants = [];
  for (const tenantId of unique) {
    const store = await readTenantStore(dataDir, tenantId);
    const emptyMetrics = {
      receivablesTotalTry: 0,
      debtorsCount: 0,
      collections30dTry: 0,
      topDebtors: [],
      pendingPaymentCount: 0,
      pendingPaymentAmountTry: 0,
      overduePaymentCount: 0,
      overduePaymentAmountTry: 0,
      dueTodayCount: 0,
      dueTomorrowCount: 0,
    };
    const summary = store ? summarizeStore(store) : {
      businessName: tenantId === 'main' ? 'Greenleaf Market' : tenantId,
      productProfile: 'unknown',
      productCount: 0,
      lowStockCount: 0,
      saleCount: 0,
      recentSaleCount30d: 0,
      revenue30dTry: 0,
      activeUserCount: 0,
      updatedAt: null,
      ...emptyMetrics,
    };
    const reg = regByTenant.get(tenantId);
    tenants.push({
      tenantId,
      label: tenantId === 'main' ? 'Greenleaf Market (main)' : tenantId,
      registrationEmail: reg?.email ?? null,
      plan: reg?.plan ?? store?.settings?.tenantMeta?.plan ?? null,
      trialEndsAt: store?.settings?.tenantMeta?.trialEndsAt ?? null,
      ...summary,
    });
  }
  tenants.sort((a, b) => a.tenantId.localeCompare(b.tenantId));
  return tenants;
}

async function allTenantIds(dataDir) {
  const ids = ['main', ...await listTenantIds(dataDir)];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

export async function listPlatformAlerts(dataDir) {
  const asOf = todayKey();
  const alerts = [];
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    if (!store) continue;
    const businessName = String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    alerts.push(...buildTenantPlatformAlerts(tenantId, businessName, store, asOf));
  }
  const order = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return {
    asOf,
    alerts,
    summary: {
      critical: alerts.filter((a) => a.severity === 'critical').length,
      warning: alerts.filter((a) => a.severity === 'warning').length,
      info: alerts.filter((a) => a.severity === 'info').length,
    },
  };
}

export async function getPlatformMergedCalendar(dataDir, year, month) {
  const monthIndex = month - 1;
  if (!Number.isFinite(year) || month < 1 || month > 12) {
    return { ok: false, error: 'Geçersiz ay/yıl' };
  }
  const storesByTenant = new Map();
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    if (!store) continue;
    const businessName = String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    storesByTenant.set(tenantId, { store, businessName });
  }
  const items = buildMergedCalendarItems(storesByTenant, year, monthIndex);
  const byDate = new Map();
  for (const item of items) {
    const list = byDate.get(item.dueDate) ?? [];
    list.push(item);
    byDate.set(item.dueDate, list);
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, dayItems]) => ({
      dateKey,
      items: dayItems,
      pendingCount: dayItems.filter((i) => i.status === 'pending').length,
      pendingAmountTry: Math.round(
        dayItems.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0) * 100,
      ) / 100,
    }));
  return {
    ok: true,
    year,
    month,
    itemCount: items.length,
    days,
    items,
  };
}

export async function getPlatformTenantDetail(dataDir, tenantId) {
  const store = await readTenantStore(dataDir, tenantId);
  if (!store) return null;
  const summary = summarizeStore(store);
  const receivablesFull = summarizeReceivables(store);
  const reminders = Array.isArray(store.settings?.paymentReminders)
    ? store.settings.paymentReminders
    : [];
  const upcomingPayments = reminders
    .filter((r) => r?.status === 'pending')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 12);
  const users = (store.users ?? []).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive !== false,
    hasRecoveryEmail: String(u.recoveryEmail ?? '').includes('@'),
    totpEnabled: u.totpEnabled === true,
    updatedAt: u.updatedAt,
  }));
  return {
    tenantId,
    ...summary,
    users,
    upcomingPayments,
    topDebtors: receivablesFull.topDebtors ?? [],
  };
}
