import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

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

export async function getPlatformTenantDetail(dataDir, tenantId) {
  const store = await readTenantStore(dataDir, tenantId);
  if (!store) return null;
  const summary = summarizeStore(store);
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
  return { tenantId, ...summary, users };
}
