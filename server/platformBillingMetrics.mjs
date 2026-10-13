/** Platform — gelir, cari ve abonelik tahmini (kiracı POS verileri) */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import {
  summarizeReceivables,
  summarizePaymentObligations,
  todayKey,
} from './platformTenantMetrics.mjs';
import { computeLifecycleStatus, readTenantLifecycleOverrides } from './platformTenantLifecycle.mjs';

/** Operasyonel tahmin — gerçek faturalandırma entegrasyonu değil */
export const PLAN_MRR_TRY = {
  trial: 0,
  'pos-lite': 0,
  standard: 2990,
  pro: 5990,
  enterprise: 12990,
};

function normalizePlan(plan) {
  const raw = String(plan ?? '').trim().toLowerCase();
  if (!raw || raw === 'trial') return 'trial';
  if (raw in PLAN_MRR_TRY) return raw;
  return raw;
}

function planMrrTry(plan) {
  const key = normalizePlan(plan);
  return PLAN_MRR_TRY[key] ?? 0;
}

function saleTimestamp(sale) {
  return Date.parse(sale?.createdAt ?? sale?.date ?? '');
}

function saleTotal(sale) {
  return Number(sale?.total ?? sale?.grandTotal ?? 0) || 0;
}

async function readRegistrations(dataDir) {
  try {
    const raw = JSON.parse(await readFile(join(dataDir, 'registrations.json'), 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

async function allTenantIds(dataDir) {
  const ids = ['main', ...await listTenantIds(dataDir)];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function dateKeyFromMs(ms) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function buildPlatformBillingOverview(dataDir, { days = 30 } = {}) {
  const windowDays = Math.min(90, Math.max(7, Number(days) || 30));
  const now = Date.now();
  const windowStart = now - windowDays * 86400000;
  const weekStart = now - 7 * 86400000;
  const asOf = todayKey();

  const registrations = await readRegistrations(dataDir);
  const regByTenant = new Map(registrations.map((r) => [r.tenantId, r]));
  const lifecycleOverrides = await readTenantLifecycleOverrides(dataDir);

  const revenueByDay = new Map();
  const tenants = [];
  const topDebtors = [];

  let revenueWindowTry = 0;
  let revenue7dTry = 0;
  let salesWindow = 0;
  let receivablesTotalTry = 0;
  let collections30dTry = 0;
  let debtorsCount = 0;
  let pendingPaymentAmountTry = 0;
  let overduePaymentAmountTry = 0;
  let overduePaymentCount = 0;
  let estimatedMrrTry = 0;
  let billableTenants = 0;

  const planMix = new Map();

  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    const reg = regByTenant.get(tenantId);
    const businessName = String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    const plan = reg?.plan ?? store?.settings?.tenantMeta?.plan ?? null;
    const planKey = normalizePlan(plan);
    const override = lifecycleOverrides[tenantId] ?? null;
    const { status } = computeLifecycleStatus({
      tenantId,
      store,
      plan,
      trialEndsAt: store?.settings?.tenantMeta?.trialEndsAt ?? null,
      override,
    });

    const receivables = store ? summarizeReceivables(store) : {
      receivablesTotalTry: 0,
      debtorsCount: 0,
      collections30dTry: 0,
      topDebtors: [],
    };
    const obligations = store ? summarizePaymentObligations(store, asOf) : {
      pendingPaymentAmountTry: 0,
      overduePaymentAmountTry: 0,
      overduePaymentCount: 0,
    };

    receivablesTotalTry += receivables.receivablesTotalTry;
    collections30dTry += receivables.collections30dTry;
    debtorsCount += receivables.debtorsCount;
    pendingPaymentAmountTry += obligations.pendingPaymentAmountTry;
    overduePaymentAmountTry += obligations.overduePaymentAmountTry;
    overduePaymentCount += obligations.overduePaymentCount;

    for (const d of receivables.topDebtors ?? []) {
      topDebtors.push({
        tenantId,
        businessName,
        customerId: d.customerId,
        name: d.name,
        balanceTry: d.balanceTry,
      });
    }

    let tenantRevenueWindow = 0;
    let tenantRevenue7d = 0;
    let tenantSalesWindow = 0;
    const sales = Array.isArray(store?.sales) ? store.sales : [];
    for (const sale of sales) {
      const t = saleTimestamp(sale);
      if (!Number.isFinite(t) || t < windowStart) continue;
      const amount = saleTotal(sale);
      tenantRevenueWindow += amount;
      tenantSalesWindow += 1;
      revenueWindowTry += amount;
      salesWindow += 1;
      const dk = dateKeyFromMs(t);
      revenueByDay.set(dk, (revenueByDay.get(dk) ?? 0) + amount);
      if (t >= weekStart) {
        tenantRevenue7d += amount;
        revenue7dTry += amount;
      }
    }

    const mrr = status === 'suspended' || status === 'missing_store' ? 0 : planMrrTry(planKey);
    if (mrr > 0 && (status === 'active' || status === 'trial')) {
      estimatedMrrTry += mrr;
      billableTenants += 1;
    }

    planMix.set(planKey, (planMix.get(planKey) ?? 0) + 1);

    const collectionRate =
      receivables.receivablesTotalTry + receivables.collections30dTry > 0
        ? Math.round(
          (receivables.collections30dTry /
              (receivables.receivablesTotalTry + receivables.collections30dTry)) *
              1000,
        ) / 10
        : null;

    tenants.push({
      tenantId,
      businessName,
      plan: planKey,
      lifecycleStatus: status,
      revenueWindowTry: Math.round(tenantRevenueWindow * 100) / 100,
      revenue7dTry: Math.round(tenantRevenue7d * 100) / 100,
      salesWindow: tenantSalesWindow,
      receivablesTotalTry: receivables.receivablesTotalTry,
      collections30dTry: receivables.collections30dTry,
      collectionRatePercent: collectionRate,
      pendingPaymentAmountTry: obligations.pendingPaymentAmountTry,
      overduePaymentAmountTry: obligations.overduePaymentAmountTry,
      estimatedMrrTry: mrr,
    });
  }

  tenants.sort((a, b) => b.revenueWindowTry - a.revenueWindowTry);
  topDebtors.sort((a, b) => b.balanceTry - a.balanceTry);

  const revenueSeries = [];
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const dk = dateKeyFromMs(now - i * 86400000);
    revenueSeries.push({
      date: dk,
      revenueTry: Math.round((revenueByDay.get(dk) ?? 0) * 100) / 100,
    });
  }

  const portfolioCollectionRate =
    receivablesTotalTry + collections30dTry > 0
      ? Math.round((collections30dTry / (receivablesTotalTry + collections30dTry)) * 1000) / 10
      : null;

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    planPricingNote:
      'Tahmini MRR, PLAN_MRR_TRY tablosuna göre hesaplanır; gerçek SaaS faturalandırması değildir.',
    totals: {
      revenueWindowTry: Math.round(revenueWindowTry * 100) / 100,
      revenue7dTry: Math.round(revenue7dTry * 100) / 100,
      salesWindow,
      receivablesTotalTry: Math.round(receivablesTotalTry * 100) / 100,
      collections30dTry: Math.round(collections30dTry * 100) / 100,
      portfolioCollectionRatePercent: portfolioCollectionRate,
      debtorsCount,
      pendingPaymentAmountTry: Math.round(pendingPaymentAmountTry * 100) / 100,
      overduePaymentAmountTry: Math.round(overduePaymentAmountTry * 100) / 100,
      overduePaymentCount,
      estimatedMrrTry,
      estimatedArrTry: estimatedMrrTry * 12,
      billableTenants,
      tenantCount: tenants.length,
    },
    planMix: [...planMix.entries()]
      .map(([plan, count]) => ({
        plan,
        count,
        mrrPerTenantTry: planMrrTry(plan),
        mrrTotalTry: planMrrTry(plan) * count,
      }))
      .sort((a, b) => b.count - a.count),
    revenueByDay: revenueSeries,
    topDebtors: topDebtors.slice(0, 15),
    tenants,
  };
}

export function buildPlatformBillingCsv(overview) {
  const lines = [
    'tenantId,businessName,plan,lifecycleStatus,revenueWindowTry,receivablesTotalTry,collections30dTry,estimatedMrrTry',
  ];
  for (const t of overview.tenants ?? []) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    lines.push(
      [
        esc(t.tenantId),
        esc(t.businessName),
        esc(t.plan),
        esc(t.lifecycleStatus),
        t.revenueWindowTry,
        t.receivablesTotalTry,
        t.collections30dTry,
        t.estimatedMrrTry,
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
