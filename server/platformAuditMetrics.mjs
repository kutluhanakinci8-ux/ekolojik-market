/** Platform — denetim merkezi: aktivite, giriş ve bildirim geçmişi */

import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import {
  summarizePlatformActivity,
  collectMergedActivities,
  buildPlatformSecurityCsv,
} from './platformActivityMetrics.mjs';
import {
  countFailedLogins24h,
  evaluateSecurityThresholdAlerts,
} from './platformSecurityNotify.mjs';
import { readSecurityAlertPolicy } from './platformSecurityPolicy.mjs';

const NOTIFY_ALERT_LABELS = {
  failed_logins_24h: '24s başarısız giriş eşiği',
  security_score_low: 'Düşük güvenlik skoru',
  high_recommendations: 'Yüksek öncelikli öneriler',
};

async function allTenantIds(dataDir) {
  const ids = ['main', ...(await listTenantIds(dataDir))];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

async function loadStoresByTenant(dataDir) {
  const storesByTenant = [];
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    if (!store) continue;
    const businessName =
      String(store?.settings?.businessName ?? '').trim()
      || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
    storesByTenant.push({ store, tenantId, businessName });
  }
  return storesByTenant;
}

function parseTime(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : null;
}

export function collectMergedLogins(storesByTenant, { sinceMs = 0, limit = 80 } = {}) {
  const rows = [];
  for (const { store, tenantId, businessName } of storesByTenant) {
    for (const entry of store?.loginAuditLog ?? []) {
      if (!entry?.createdAt) continue;
      const t = parseTime(entry.createdAt);
      if (sinceMs && (t == null || t < sinceMs)) continue;
      rows.push({
        kind: 'login',
        tenantId,
        businessName,
        createdAt: entry.createdAt,
        success: entry.success === true,
        username: entry.username,
        displayName: entry.displayName,
        clientIp: entry.clientIp ?? null,
        method: entry.method ?? 'password',
        failureReason: entry.failureReason ?? null,
        title: entry.success ? 'Başarılı giriş' : 'Başarısız giriş',
        detail: entry.success
          ? entry.method ?? 'password'
          : entry.failureReason ?? 'Kimlik doğrulama hatası',
      });
    }
  }
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows.slice(0, limit);
}

export function buildMergedEventTimeline(storesByTenant, { sinceMs = 0, limit = 60 } = {}) {
  const logins = collectMergedLogins(storesByTenant, { sinceMs, limit });
  const activities = collectMergedActivities(storesByTenant, {
    sinceMs,
    securityOnly: false,
    limit,
  }).map((row) => ({
    kind: 'activity',
    tenantId: row.tenantId,
    businessName: row.businessName,
    createdAt: row.createdAt,
    success: true,
    username: row.username,
    displayName: row.displayName,
    clientIp: null,
    title: row.actionLabel,
    detail: row.summary ?? row.action,
    action: row.action,
  }));

  const merged = [...logins, ...activities];
  merged.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return merged.slice(0, limit);
}

function buildNotifyHistory(policy) {
  return Object.entries(policy.lastFired ?? {})
    .map(([alertId, at]) => ({
      alertId,
      label: NOTIFY_ALERT_LABELS[alertId] ?? alertId,
      lastFiredAt: at,
    }))
    .sort((a, b) => String(b.lastFiredAt).localeCompare(String(a.lastFiredAt)));
}

export async function buildPlatformAuditOverview(dataDir, { days = 30 } = {}) {
  const windowDays = Math.min(Math.max(Number(days) || 30, 7), 180);
  const storesByTenant = await loadStoresByTenant(dataDir);
  const sinceMs = Date.now() - windowDays * MS_DAY;

  const activity = summarizePlatformActivity(storesByTenant, windowDays);
  const failedLogins24h = countFailedLogins24h(storesByTenant);
  const policy = await readSecurityAlertPolicy(dataDir);

  let loginStats = { success: 0, failed: 0 };
  for (const { store } of storesByTenant) {
    for (const entry of store?.loginAuditLog ?? []) {
      const t = parseTime(entry?.createdAt);
      if (t == null || t < sinceMs) continue;
      if (entry.success === true) loginStats.success += 1;
      else loginStats.failed += 1;
    }
  }

  const { computeSecurityScore, buildSecurityRecommendations } = await import('./platformSecurityMetrics.mjs');
  const { analyzeTenantUsers, mergeRecentLogins, buildPlatformUserOperations } = await import(
    './platformUserMetrics.mjs'
  );
  const analytics = storesByTenant.map(({ store, tenantId, businessName }) =>
    analyzeTenantUsers(store, tenantId, businessName),
  );
  const userOps = buildPlatformUserOperations(analytics, mergeRecentLogins(storesByTenant, 20));
  const failedByIp = (await import('./platformSecurityMetrics.mjs')).aggregateFailedByIp(storesByTenant, 7);
  const recommendations = buildSecurityRecommendations(
    userOps.totals,
    userOps.roster,
    failedByIp,
    userOps.tenants,
  );
  const scorePayload = computeSecurityScore(userOps.totals, userOps.roster, recommendations);
  const thresholdAlerts = evaluateSecurityThresholdAlerts(
    {
      score: scorePayload.score,
      recommendationSummary: {
        high: recommendations.filter((r) => r.priority === 'high').length,
        medium: recommendations.filter((r) => r.priority === 'medium').length,
        total: recommendations.length,
      },
    },
    failedLogins24h,
    policy,
  );

  const timeline = buildMergedEventTimeline(storesByTenant, { sinceMs, limit: 55 });
  const recentFailedLogins = collectMergedLogins(storesByTenant, { sinceMs, limit: 20 }).filter(
    (r) => !r.success,
  );

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    totals: {
      activityEvents: activity.events30d,
      securityActivityEvents: activity.securityEvents30d,
      loginSuccess: loginStats.success,
      loginFailed: loginStats.failed,
      failedLogins24h,
    },
    activity,
    timeline,
    recentFailedLogins,
    notify: {
      policyEnabled: policy.enabled,
      emailOps: policy.emailOps,
      webhookConfigured: Boolean(policy.webhookUrl?.trim()),
      thresholds: policy.thresholds,
      cooldownMinutes: policy.cooldownMinutes,
      history: buildNotifyHistory(policy),
      activeThresholds: thresholdAlerts,
    },
    securityScore: scorePayload.score,
  };
}

export async function buildPlatformAuditExportCsv(dataDir, days = 90) {
  const storesByTenant = await loadStoresByTenant(dataDir);
  const safeDays = Math.min(180, Math.max(7, Number(days) || 90));
  const csv = buildPlatformSecurityCsv(storesByTenant, safeDays);
  const stamp = new Date().toISOString().slice(0, 10);
  return { csv, filename: `platform-denetim-${stamp}.csv` };
}
