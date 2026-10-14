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

export async function getPlatformSecurityOverview(dataDir) {
  const { analyzeTenantUsers, mergeRecentLogins, buildPlatformUserOperations } = await import(
    './platformUserMetrics.mjs'
  );
  const {
    buildLoginTrend,
    aggregateFailedByIp,
    buildSecurityRecommendations,
    computeSecurityScore,
    tenantSecuritySnapshots,
    buildPlatformSecurityOverview,
  } = await import('./platformSecurityMetrics.mjs');

  const storesByTenant = [];
  const analytics = [];
  const allLoginEntries = [];

  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    if (!store) continue;
    const businessName = String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    storesByTenant.push({ store, tenantId, businessName });
    analytics.push(analyzeTenantUsers(store, tenantId, businessName));
    for (const e of store.loginAuditLog ?? []) {
      allLoginEntries.push(e);
    }
  }

  const recentLogins = mergeRecentLogins(storesByTenant, 50);
  const userOps = buildPlatformUserOperations(analytics, recentLogins);
  const roster = userOps.roster;
  const failedByIp = aggregateFailedByIp(storesByTenant, 7);
  const recommendations = buildSecurityRecommendations(
    userOps.totals,
    roster,
    failedByIp,
    userOps.tenants,
  );
  const scorePayload = computeSecurityScore(userOps.totals, roster, recommendations);
  const loginTrend = buildLoginTrend(allLoginEntries, 14);
  const tenantSnapshots = tenantSecuritySnapshots(analytics);
  const { summarizePlatformActivity } = await import('./platformActivityMetrics.mjs');
  const activitySummary = summarizePlatformActivity(storesByTenant, 30);

  const overview = buildPlatformSecurityOverview({
    userOps,
    loginTrend,
    failedByIp,
    recommendations,
    scorePayload,
    tenantSnapshots,
    activitySummary,
  });

  const { readSecurityAlertPolicy } = await import('./platformSecurityPolicy.mjs');
  const { evaluateSecurityThresholdAlerts, countFailedLogins24h } = await import('./platformSecurityNotify.mjs');
  const { readPlatformSessionEpoch } = await import('./platformSessionRevoke.mjs');
  const alertPolicy = await readSecurityAlertPolicy(dataDir);
  const failedLogins24h = countFailedLogins24h(storesByTenant);
  const thresholdAlerts = evaluateSecurityThresholdAlerts(
    {
      score: overview.score,
      recommendationSummary: overview.recommendationSummary,
    },
    failedLogins24h,
    alertPolicy,
  );

  return {
    ...overview,
    failedLogins24h,
    thresholdAlerts,
    alertPolicy,
    platformSessionEpoch: await readPlatformSessionEpoch(dataDir),
    revokeCandidates: userOps.roster
      .filter((u) => u.isActive)
      .slice(0, 40)
      .map((u) => ({
        tenantId: u.tenantId,
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        businessName: u.businessName,
        role: u.role,
      })),
  };
}

export async function updatePlatformSecurityAlertPolicy(dataDir, patch) {
  const { readSecurityAlertPolicy, writeSecurityAlertPolicy } = await import('./platformSecurityPolicy.mjs');
  const current = await readSecurityAlertPolicy(dataDir);
  const next = await writeSecurityAlertPolicy(dataDir, {
    ...current,
    ...patch,
    thresholds: { ...current.thresholds, ...(patch?.thresholds ?? {}) },
  });
  return { ok: true, policy: next };
}

export async function platformSecurityNotifyCheck(dataDir, { force = false } = {}) {
  const overview = await getPlatformSecurityOverview(dataDir);
  const storesByTenant = [];
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    if (!store) continue;
    const businessName = String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    storesByTenant.push({ store, tenantId, businessName });
  }
  const { runSecurityNotifyCheck } = await import('./platformSecurityNotify.mjs');
  return runSecurityNotifyCheck(dataDir, overview, storesByTenant, { force });
}

export async function platformRevokeAllSessions(dataDir) {
  const { bumpPlatformSessionEpoch } = await import('./platformSessionRevoke.mjs');
  const epoch = await bumpPlatformSessionEpoch(dataDir);
  return { ok: true, platformSessionEpoch: epoch };
}

export async function platformRevokeTenantUserSession(dataDir, tenantId, userId) {
  const { bumpTenantUserAuthEpoch } = await import('./platformSessionRevoke.mjs');
  const result = await bumpTenantUserAuthEpoch(dataDir, tenantId, userId);
  if (!result.ok) return result;
  return { ok: true, ...result };
}

export async function getPlatformSecurityExportCsv(dataDir, days = 90) {
  const storesByTenant = [];
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    if (!store) continue;
    const businessName = String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    storesByTenant.push({ store, tenantId, businessName });
  }
  const { buildPlatformSecurityCsv } = await import('./platformActivityMetrics.mjs');
  const safeDays = Math.min(180, Math.max(7, Number(days) || 90));
  const csv = buildPlatformSecurityCsv(storesByTenant, safeDays);
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `platform-guvenlik-${stamp}.csv` };
}

export async function getPlatformAuditOverview(dataDir, { days = 30 } = {}) {
  const { buildPlatformAuditOverview } = await import('./platformAuditMetrics.mjs');
  const safeDays = Math.min(180, Math.max(7, Number(days) || 30));
  return buildPlatformAuditOverview(dataDir, { days: safeDays });
}

export async function getPlatformAuditExportCsv(dataDir, days = 90) {
  const { buildPlatformAuditExportCsv } = await import('./platformAuditMetrics.mjs');
  const safeDays = Math.min(180, Math.max(7, Number(days) || 90));
  return buildPlatformAuditExportCsv(dataDir, safeDays);
}

export async function getPlatformBillingOverview(dataDir, { days = 30 } = {}) {
  const { buildPlatformBillingOverview } = await import('./platformBillingMetrics.mjs');
  const safeDays = Math.min(90, Math.max(7, Number(days) || 30));
  return buildPlatformBillingOverview(dataDir, { days: safeDays });
}

export async function getPlatformBillingExportCsv(dataDir, days = 30) {
  const overview = await getPlatformBillingOverview(dataDir, { days });
  const { buildPlatformBillingCsv } = await import('./platformBillingMetrics.mjs');
  const csv = buildPlatformBillingCsv(overview);
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `platform-gelir-${stamp}.csv` };
}

export async function getPlatformSupportOverview(dataDir, { days } = {}) {
  const { buildPlatformSupportOverview } = await import('./platformSupportMetrics.mjs');
  return buildPlatformSupportOverview(dataDir, { days });
}

export async function updatePlatformSupportSlaPolicy(dataDir, patch) {
  const { writeSupportSlaPolicy } = await import('./platformSupportPolicy.mjs');
  const policy = await writeSupportSlaPolicy(dataDir, patch);
  return { ok: true, policy };
}

export async function getPlatformSupportExportCsv(dataDir, days) {
  const overview = await getPlatformSupportOverview(dataDir, { days });
  const { buildPlatformSupportCsv } = await import('./platformSupportMetrics.mjs');
  const csv = buildPlatformSupportCsv(overview);
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `platform-destek-${stamp}.csv` };
}

export async function getPlatformSettingsOverview(dataDir) {
  const { buildPlatformSettingsOverview } = await import('./platformSettingsMetrics.mjs');
  return buildPlatformSettingsOverview(dataDir);
}

export async function patchPlatformConsoleSettings(dataDir, patch) {
  const { writeConsoleSettings } = await import('./platformConsoleSettings.mjs');
  const console = await writeConsoleSettings(dataDir, patch ?? {});
  return { ok: true, console };
}

export async function getPlatformIntegrationsOverview(dataDir) {
  const { buildPlatformIntegrationsOverview } = await import('./platformIntegrationsMetrics.mjs');
  return buildPlatformIntegrationsOverview(dataDir);
}

export async function platformIntegrationsProbe(dataDir, options = {}) {
  const { runPlatformIntegrationProbes } = await import('./platformIntegrationsMetrics.mjs');
  return runPlatformIntegrationProbes(dataDir, options);
}

export async function getPlatformIntegrationsExportCsv(dataDir) {
  const overview = await getPlatformIntegrationsOverview(dataDir);
  const { buildPlatformIntegrationsCsv } = await import('./platformIntegrationsMetrics.mjs');
  const csv = buildPlatformIntegrationsCsv(overview);
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `platform-entegrasyon-${stamp}.csv` };
}

export async function getPlatformInfrastructureOverview(dataDir) {
  const { buildPlatformInfrastructureOverview } = await import('./platformInfrastructureMetrics.mjs');
  return buildPlatformInfrastructureOverview(dataDir);
}

export async function platformInfrastructureProbe(dataDir, options = {}) {
  const { runInfrastructureProbes } = await import('./platformInfrastructureMetrics.mjs');
  return runInfrastructureProbes(dataDir, options);
}

export async function getPlatformTenantsLifecycle(dataDir) {
  const { buildPlatformTenantsLifecycle } = await import('./platformTenantLifecycle.mjs');
  return buildPlatformTenantsLifecycle(dataDir);
}

export async function getPlatformSupportInbox(dataDir, options = {}) {
  const { listPlatformSupportInbox } = await import('./platformSupportInbox.mjs');
  return listPlatformSupportInbox(dataDir, options);
}

export async function syncPlatformSupportInbox(dataDir, options = {}) {
  const { syncPlatformSupportInbox: sync } = await import('./platformSupportInbox.mjs');
  return sync(dataDir, options);
}

export async function replyPlatformSupportInboxMessage(dataDir, payload, operatorUsername) {
  const { replyPlatformSupportInbox } = await import('./platformSupportInbox.mjs');
  return replyPlatformSupportInbox(dataDir, { ...payload, operatorUsername });
}

export async function getPlatformSupportCases(dataDir, query = {}) {
  const { listPlatformSupportCases } = await import('./platformSupportCases.mjs');
  return listPlatformSupportCases(dataDir, query);
}

export async function getPlatformSupportCaseTags(dataDir) {
  const { listPlatformSupportCaseTags } = await import('./platformSupportCases.mjs');
  return listPlatformSupportCaseTags(dataDir);
}

export async function markPlatformSupportInboxRead(dataDir, body) {
  const { markPlatformSupportInboxMessagesRead } = await import('./platformSupportInbox.mjs');
  return markPlatformSupportInboxMessagesRead(dataDir, body?.messageIds ?? []);
}

export async function patchPlatformSupportCase(dataDir, caseId, patch, operatorUsername) {
  const { getPlatformCase, updatePlatformCase, appendCaseActivity } = await import('./platformCaseStore.mjs');
  const before = await getPlatformCase(dataDir, caseId);
  const next = { ...patch };
  if (next.externalTicketRef != null && next.externalTicketRef !== false) {
    const { enrichExternalTicketRef } = await import('./platformSupportZendesk.mjs');
    next.externalTicketRef = enrichExternalTicketRef(next.externalTicketRef);
  }
  const result = await updatePlatformCase(dataDir, caseId, next, operatorUsername);
  if (!result.ok) return result;

  const after = result.case;
  const changes = [];
  if (patch.status != null && before && after && before.status !== after.status) {
    changes.push(`durum: ${before.status} → ${after.status}`);
  }
  if (patch.priority != null && before && after && before.priority !== after.priority) {
    changes.push(`öncelik: ${before.priority} → ${after.priority}`);
  }
  if (patch.kind != null && before && after && before.kind !== after.kind) {
    changes.push(`tür: ${before.kind} → ${after.kind}`);
  }
  if (patch.assignee !== undefined && before && after && before.assignee !== after.assignee) {
    changes.push(`atanan: ${before.assignee ?? '—'} → ${after.assignee ?? '—'}`);
  }
  if (patch.notes != null && before && after && before.notes !== after.notes) {
    changes.push('iç notlar güncellendi');
  }
  if (patch.tags != null && before && after) {
    const a = (before.tags ?? []).join(',');
    const b = (after.tags ?? []).join(',');
    if (a !== b) changes.push(`etiketler: ${(after.tags ?? []).join(', ') || '—'}`);
  }
  if (changes.length) {
    await appendCaseActivity(
      dataDir,
      caseId,
      { type: 'case_updated', body: changes.join(' · '), channel: 'internal' },
      operatorUsername ?? 'platform',
    );
  }

  let zendeskSync = null;
  if (patch.status != null && before && before.status !== after?.status) {
    const { syncPlatformCaseStatusToZendesk } = await import('./platformSupportZendesk.mjs');
    const sync = await syncPlatformCaseStatusToZendesk(dataDir, caseId);
    zendeskSync = sync.ok ? { ok: true, zendeskStatus: sync.zendeskStatus } : { ok: false, error: sync.error };
  }

  return zendeskSync ? { ...result, zendeskSync } : result;
}

export async function getPlatformSupportCommands() {
  const { listPlatformSupportCommands } = await import('./platformSupportCommands.mjs');
  return { ok: true, commands: listPlatformSupportCommands() };
}

export async function getPlatformSupportZendeskBridge(dataDir) {
  const { getZendeskBridgeConfig } = await import('./platformSupportZendesk.mjs');
  return { ok: true, ...getZendeskBridgeConfig() };
}

export async function postPlatformSupportZendeskWebhook(dataDir, body) {
  const { processZendeskWebhook } = await import('./platformSupportZendesk.mjs');
  return processZendeskWebhook(dataDir, body);
}

export async function postPlatformSupportCaseZendeskPush(dataDir, caseId, operatorUsername) {
  const { pushPlatformCaseSummaryToZendesk } = await import('./platformSupportZendesk.mjs');
  const result = await pushPlatformCaseSummaryToZendesk(dataDir, caseId);
  if (result.ok) return result;
  return { ok: false, status: result.status ?? 400, error: result.error };
}

export async function postPlatformSupportCaseZendeskCreate(dataDir, caseId, operatorUsername) {
  const { createZendeskTicketFromPlatformCase } = await import('./platformSupportZendesk.mjs');
  const result = await createZendeskTicketFromPlatformCase(dataDir, caseId, operatorUsername);
  if (result.ok) return result;
  return { ok: false, status: result.status ?? 400, error: result.error };
}

export async function postPlatformSupportCaseZendeskSyncStatus(dataDir, caseId) {
  const { syncPlatformCaseStatusToZendesk } = await import('./platformSupportZendesk.mjs');
  const result = await syncPlatformCaseStatusToZendesk(dataDir, caseId);
  if (result.ok) return result;
  return { ok: false, status: result.status ?? 400, error: result.error };
}

export async function getPlatformSupportMacros(dataDir) {
  const { listPlatformSupportMacros } = await import('./platformSupportCaseOmni.mjs');
  const macros = await listPlatformSupportMacros(dataDir);
  return { ok: true, macros };
}

export async function putPlatformSupportMacros(dataDir, body) {
  const { savePlatformSupportMacros } = await import('./platformSupportCaseOmni.mjs');
  const macros = body?.macros ?? body;
  const result = await savePlatformSupportMacros(dataDir, macros);
  if (!result.ok) return { ok: false, status: 400, error: result.error };
  return result;
}

export async function createPlatformSupportCase(dataDir, input, operatorUsername) {
  const { createPlatformCase } = await import('./platformCaseStore.mjs');
  return createPlatformCase(dataDir, input, operatorUsername);
}

export async function createPlatformSupportCaseFromInbox(dataDir, messageId, operatorUsername) {
  const { createCaseFromInboxMessage } = await import('./platformSupportCases.mjs');
  return createCaseFromInboxMessage(dataDir, messageId, operatorUsername);
}

export async function createPlatformSupportCaseFromQueue(dataDir, payload, operatorUsername) {
  const { createCaseFromMessagingQueue } = await import('./platformSupportCases.mjs');
  return createCaseFromMessagingQueue(dataDir, payload, operatorUsername);
}

export async function getPlatformSupportCasesExportCsv(dataDir) {
  const payload = await getPlatformSupportCases(dataDir, { limit: 500 });
  const { buildPlatformCasesCsv } = await import('./platformSupportCases.mjs');
  const csv = buildPlatformCasesCsv(payload);
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `platform-talepler-${stamp}.csv` };
}

export async function getPlatformSupportCaseDetail(dataDir, caseId) {
  const { getPlatformSupportCaseDetail: detail } = await import('./platformSupportCaseOmni.mjs');
  return detail(dataDir, caseId);
}

export async function getPlatformSupportCaseActivityExport(dataDir, caseId, format, { filter } = {}) {
  const { getPlatformCase } = await import('./platformCaseStore.mjs');
  const caseRow = await getPlatformCase(dataDir, caseId);
  if (!caseRow) return { ok: false, error: 'Kayıt bulunamadı' };

  const {
    buildCaseActivityCsv,
    buildCaseActivityPrintHtml,
    caseActivityExportFilename,
    CASE_ACTIVITY_EXPORT_FILTERS,
  } = await import('./platformSupportCaseExport.mjs');

  const normalizedFilter = String(filter ?? 'all').trim();
  if (!CASE_ACTIVITY_EXPORT_FILTERS.has(normalizedFilter)) {
    return { ok: false, error: 'Geçersiz filtre' };
  }

  if (format === 'csv') {
    return {
      ok: true,
      body: buildCaseActivityCsv(caseRow, { filter: normalizedFilter }),
      contentType: 'text/csv; charset=utf-8',
      filename: caseActivityExportFilename(caseRow, 'csv', normalizedFilter),
    };
  }
  if (format === 'html') {
    return {
      ok: true,
      body: buildCaseActivityPrintHtml(caseRow, { filter: normalizedFilter }),
      contentType: 'text/html; charset=utf-8',
      filename: caseActivityExportFilename(caseRow, 'html', normalizedFilter),
    };
  }
  return { ok: false, error: 'Geçersiz format' };
}

export async function postPlatformSupportCaseAction(dataDir, caseId, body, operatorUsername) {
  const { performPlatformCaseAction } = await import('./platformSupportCaseOmni.mjs');
  return performPlatformCaseAction(dataDir, caseId, body, operatorUsername);
}

export async function getPlatformSupportContactQueue(dataDir, query = {}) {
  const { listPlatformSupportContactQueue } = await import('./platformSupportCases.mjs');
  return listPlatformSupportContactQueue(dataDir, query);
}

export async function createPlatformSupportCaseFromContact(dataDir, contactId, operatorUsername) {
  const { createCaseFromContactMessage } = await import('./platformSupportCases.mjs');
  return createCaseFromContactMessage(dataDir, contactId, operatorUsername);
}

export async function getPlatformSupportTenant360(dataDir, tenantId) {
  const { buildPlatformSupportTenant360 } = await import('./platformSupportTenant360.mjs');
  return buildPlatformSupportTenant360(dataDir, tenantId);
}

export async function postPlatformSupportCommand(dataDir, body, operatorUsername) {
  const { runPlatformSupportCommand, listPlatformSupportCommands } = await import('./platformSupportCommands.mjs');
  if (body?.list === true) {
    return { ok: true, commands: listPlatformSupportCommands() };
  }
  return runPlatformSupportCommand(dataDir, body, operatorUsername);
}

export async function getPlatformSupportSlaLive(dataDir, query = {}) {
  const { buildPlatformSupportSlaLive } = await import('./platformSupportSlaLive.mjs');
  return buildPlatformSupportSlaLive(dataDir, query);
}

export async function suggestPlatformSupportCaseAi(dataDir, caseId, body = {}) {
  const { suggestPlatformSupportCaseAi: suggest } = await import('./platformSupportAi.mjs');
  return suggest(dataDir, caseId, body);
}

export async function patchPlatformTenantLifecycle(dataDir, tenantId, patch, operatorUsername) {
  const { updatePlatformTenantLifecycle } = await import('./platformTenantLifecycle.mjs');
  return updatePlatformTenantLifecycle(dataDir, tenantId, patch, operatorUsername);
}

export async function getPlatformCommsOverview(dataDir, { days = 14 } = {}) {
  const { buildPlatformCommsOverview } = await import('./platformCommsMetrics.mjs');
  const safeDays = Math.min(90, Math.max(1, Number(days) || 14));
  return buildPlatformCommsOverview(dataDir, { days: safeDays });
}

export async function platformCommsProcessOutbox(dataDir, { limit = 30 } = {}) {
  const { createDeliverMessage } = await import('./emailOutboxProcessor.mjs');
  const { processPendingOutbox } = await import('./emailOutbox.mjs');
  const deliver = createDeliverMessage(dataDir);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));
  const run = await processPendingOutbox(dataDir, deliver, { limit: safeLimit });
  return { ok: true, processed: run };
}

export async function platformCommsRequeueFailed(dataDir, { tenantId, all = true, ids = [] } = {}) {
  const { bulkRequeueFailedOutbox } = await import('./emailOutbox.mjs');
  const useAll = all === true && (!ids || ids.length === 0);
  const result = await bulkRequeueFailedOutbox(dataDir, {
    tenantId: tenantId ? String(tenantId).trim() : undefined,
    all: useAll,
    ids: useAll ? [] : ids,
  });
  return result;
}

export async function getPlatformCommsExportCsv(dataDir, days = 14) {
  const overview = await getPlatformCommsOverview(dataDir, { days });
  const { buildPlatformCommsCsv } = await import('./platformCommsMetrics.mjs');
  const csv = buildPlatformCommsCsv({
    tenants: overview.tenants,
    windowDays: overview.windowDays,
    generatedAt: overview.generatedAt,
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `platform-posta-mesaj-${stamp}.csv` };
}

export async function getPlatformUserOperations(dataDir) {
  const { analyzeTenantUsers, mergeRecentLogins, buildPlatformUserOperations } = await import(
    './platformUserMetrics.mjs'
  );
  const storesByTenant = [];
  const analytics = [];
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    if (!store) continue;
    const businessName = String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    storesByTenant.push({ store, tenantId, businessName });
    analytics.push(analyzeTenantUsers(store, tenantId, businessName));
  }
  const recentLogins = mergeRecentLogins(storesByTenant, 50);
  return buildPlatformUserOperations(analytics, recentLogins);
}
