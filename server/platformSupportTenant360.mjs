/** Destek D5 — kiracı 360 özet (muhasebe, stok, güvenlik, posta, demo) */

import { readTenantStore } from './tenantAuth.mjs';
import { buildPlatformTenantsLifecycle } from './platformTenantLifecycle.mjs';
import { readPlatformCases } from './platformCaseStore.mjs';
import { analyzeTenantUsers, mergeRecentLogins } from './platformUserMetrics.mjs';
import { tenantSecuritySnapshots } from './platformSecurityMetrics.mjs';
import { normalizeTenantId } from './tenantAllowlist.mjs';

function isDemoTenant(tenantId, businessName) {
  const id = String(tenantId ?? '').toLowerCase();
  const name = String(businessName ?? '').toLowerCase();
  return id === 'main' || id.includes('greenleaf') || name.includes('greenleaf') || name.includes('demo');
}

export async function buildPlatformSupportTenant360(dataDir, tenantId) {
  const id = normalizeTenantId(tenantId);
  if (!id) return { ok: false, error: 'Geçersiz kiracı' };

  const { getPlatformTenantDetail } = await import('./platformApi.mjs');
  const detail = await getPlatformTenantDetail(dataDir, id);
  if (!detail) return { ok: false, error: 'Mağaza bulunamadı' };

  const store = await readTenantStore(dataDir, id);
  const businessName = detail.businessName ?? id;

  const lifecyclePayload = await buildPlatformTenantsLifecycle(dataDir);
  const lifecycle = lifecyclePayload.tenants.find((t) => t.tenantId === id) ?? null;

  const { getOutboxCountsByTenant } = await import('./emailOutbox.mjs');
  const { getMessagingSlaMetrics } = await import('./messaging/sla.mjs');
  const outboxRows = await getOutboxCountsByTenant(dataDir);
  const outbox = outboxRows.find((r) => r.tenantId === id) ?? { pending: 0, sent: 0, failed: 0 };
  const messaging = await getMessagingSlaMetrics(dataDir, id, { days: 14 });

  const userAnalytics = store ? analyzeTenantUsers(store, id, businessName) : null;
  const security = userAnalytics
    ? tenantSecuritySnapshots([userAnalytics])[0] ?? null
    : null;
  const recentLogins = store
    ? mergeRecentLogins([{ store, tenantId: id, businessName }], 25)
    : [];

  const cases = (await readPlatformCases(dataDir))
    .filter((c) => c.tenantId === id || c.links?.tenantId === id)
    .slice(0, 8);

  const lowStockSample = (store?.products ?? [])
    .filter((p) => {
      const threshold = Number(store?.settings?.lowStockThreshold) || 10;
      return (Number(p?.stock) || 0) <= threshold;
    })
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      name: p.name ?? p.title ?? '—',
      stock: Number(p.stock) || 0,
    }));

  const loginAlerts = recentLogins.filter((e) => !e.success).slice(0, 8);

  const userRoster = (userAnalytics?.roster ?? []).map((u) => ({
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    lastLoginAt: u.lastLoginAt,
    mustChangePassword: u.mustChangePassword,
    totpEnabled: u.totpEnabled,
    engagement: u.engagement,
  }));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    tenantId: id,
    businessName,
    demo: isDemoTenant(id, businessName),
    lifecycle,
    userRoster,
    loginAlerts,
    loginActivity: recentLogins,
    loginSummary: userAnalytics
      ? {
          totalUsers: userAnalytics.totalUsers,
          activeCount: userAnalytics.activeCount,
          loginSuccess30d: userAnalytics.loginSuccess30d,
          loginFailed30d: userAnalytics.loginFailed30d,
        }
      : null,
    accounting: {
      receivablesTotalTry: detail.receivablesTotalTry ?? 0,
      debtorsCount: detail.debtorsCount ?? 0,
      collections30dTry: detail.collections30dTry ?? 0,
      overduePaymentCount: detail.overduePaymentCount ?? 0,
      overduePaymentAmountTry: detail.overduePaymentAmountTry ?? 0,
      pendingPaymentCount: detail.pendingPaymentCount ?? 0,
      topDebtors: (detail.topDebtors ?? []).slice(0, 5),
      upcomingPayments: (detail.upcomingPayments ?? []).slice(0, 5),
    },
    stock: {
      productCount: detail.productCount ?? 0,
      lowStockCount: detail.lowStockCount ?? 0,
      lowStockSample,
    },
    sales: {
      recentSaleCount30d: detail.recentSaleCount30d ?? 0,
      revenue30dTry: detail.revenue30dTry ?? 0,
    },
    security,
    comms: {
      outbox: { pending: outbox.pending, sent: outbox.sent, failed: outbox.failed },
      messaging: messaging.counts,
      firstResponse: messaging.firstResponse,
    },
    users: (detail.users ?? []).slice(0, 8),
    openCases: cases,
    quickLinks: {
      platformTenants: true,
      posPath: `/app?tenant=${encodeURIComponent(id)}`,
    },
  };
}
