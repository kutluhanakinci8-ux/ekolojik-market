import { getEkolojikOpsEmail } from './ekolojikMailConfig.mjs';
import { enqueueEkolojikMail } from './emailOutbox.mjs';
import { readSecurityAlertPolicy, writeSecurityAlertPolicy, DEFAULT_SECURITY_ALERT_POLICY } from './platformSecurityPolicy.mjs';

const MS_MIN = 60 * 1000;

function parseTime(iso) {
  const t = Date.parse(iso ?? '');
  return Number.isFinite(t) ? t : null;
}

export function countFailedLogins24h(storesByTenant, asOfMs = Date.now()) {
  const since = asOfMs - 24 * 60 * 60 * 1000;
  let count = 0;
  for (const { store } of storesByTenant) {
    for (const entry of store?.loginAuditLog ?? []) {
      if (entry?.success !== false) continue;
      const t = parseTime(entry.createdAt);
      if (t != null && t >= since) count += 1;
    }
  }
  return count;
}

export function evaluateSecurityThresholdAlerts(overview, failedLogins24h, policy) {
  if (!policy.enabled) return [];
  const alerts = [];
  const th = policy.thresholds ?? DEFAULT_SECURITY_ALERT_POLICY.thresholds;

  if (failedLogins24h >= th.failedLogins24h) {
    alerts.push({
      id: 'failed_logins_24h',
      severity: 'high',
      title: '24 saatte yüksek başarısız giriş',
      detail: `${failedLogins24h} başarısız deneme (eşik: ${th.failedLogins24h})`,
      metric: failedLogins24h,
      threshold: th.failedLogins24h,
    });
  }
  if (overview.score < th.securityScoreBelow) {
    alerts.push({
      id: 'security_score_low',
      severity: 'high',
      title: 'Güvenlik skoru düşük',
      detail: `Skor ${overview.score} (eşik: ${th.securityScoreBelow})`,
      metric: overview.score,
      threshold: th.securityScoreBelow,
    });
  }
  const highRecs = overview.recommendationSummary?.high ?? 0;
  if (highRecs >= th.highRecommendations) {
    alerts.push({
      id: 'high_recommendations',
      severity: 'medium',
      title: 'Çok sayıda yüksek öncelikli öneri',
      detail: `${highRecs} yüksek öneri (eşik: ${th.highRecommendations})`,
      metric: highRecs,
      threshold: th.highRecommendations,
    });
  }
  return alerts;
}

function cooldownOk(policy, alertId, nowMs) {
  const last = policy.lastFired?.[alertId];
  if (!last) return true;
  const t = parseTime(last);
  if (t == null) return true;
  const cool = (Number(policy.cooldownMinutes) || 360) * MS_MIN;
  return nowMs - t >= cool;
}

async function postWebhook(url, body) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed.startsWith('https://')) return { ok: false, skipped: true };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(trimmed, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'webhook failed' };
  } finally {
    clearTimeout(timer);
  }
}

export async function runSecurityNotifyCheck(dataDir, overview, storesByTenant, { force = false } = {}) {
  const policy = await readSecurityAlertPolicy(dataDir);
  const failedLogins24h = countFailedLogins24h(storesByTenant);
  const triggered = evaluateSecurityThresholdAlerts(overview, failedLogins24h, policy);
  const nowMs = Date.now();
  const toSend = force
    ? triggered
    : triggered.filter((a) => cooldownOk(policy, a.id, nowMs));

  if (!toSend.length) {
    return {
      ok: true,
      sent: false,
      triggered,
      failedLogins24h,
      policy,
      message: triggered.length ? 'Bildirim bekleme süresinde (cooldown)' : 'Eşik aşımı yok',
    };
  }

  const lines = toSend.map((a) => `• [${a.severity}] ${a.title}: ${a.detail}`).join('\n');
  const subject = `Ekolojik Platform güvenlik uyarısı (${toSend.length})`;
  const text = `Platform güvenlik eşikleri aşıldı.\n\n${lines}\n\nSkor: ${overview.score}\nZaman: ${new Date().toISOString()}`;

  const results = { email: null, webhook: null };

  if (policy.emailOps) {
    const ops = getEkolojikOpsEmail();
    if (ops) {
      results.email = await enqueueEkolojikMail(dataDir, {
        to: ops,
        subject,
        text,
        source: 'platform-security-alert',
        tenantId: 'main',
        idempotencyKey: `platform-sec:${toSend.map((a) => a.id).join(',')}:${new Date().toISOString().slice(0, 13)}`,
      });
    } else {
      results.email = { ok: false, error: 'EKOLOJIK_OPS_EMAIL tanımlı değil' };
    }
  }

  if (policy.webhookUrl?.trim()) {
    results.webhook = await postWebhook(policy.webhookUrl, {
      type: 'platform.security.alert',
      generatedAt: new Date().toISOString(),
      score: overview.score,
      alerts: toSend,
      failedLogins24h,
    });
  }

  const lastFired = { ...(policy.lastFired ?? {}) };
  for (const a of toSend) {
    lastFired[a.id] = new Date().toISOString();
  }
  const nextPolicy = await writeSecurityAlertPolicy(dataDir, { ...policy, lastFired });

  return {
    ok: true,
    sent: true,
    triggered,
    dispatched: toSend,
    failedLogins24h,
    policy: nextPolicy,
    results,
  };
}
