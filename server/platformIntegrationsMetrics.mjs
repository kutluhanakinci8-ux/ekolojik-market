/** Platform — entegrasyonlar, webhook ve kanal durumu */

import { readTenantStore, listTenantIds } from './tenantAuth.mjs';
import {
  isEkolojikImapConfigured,
  isEkolojikSmtpConfigured,
  getEkolojikMailConfig,
  getEkolojikImapConfig,
  getEkolojikOpsEmail,
} from './ekolojikMailConfig.mjs';
import { isLertaPlatformConfigured } from './lertaPlatformBridge.mjs';
import { isMailTrackEnabled } from './postaMailTrack.mjs';
import { isClickTrackEnabled, engagementWebhookConfigured, fireEngagementWebhook } from './postaEngagement.mjs';
import {
  resolveEffectiveMessagingPublicKey,
  maskMessagingPublicKey,
  isMessagingPublicApiConfigured,
} from './messaging/publicConfig.mjs';
import { isTenantImapConfigured, getTenantMailConfigHub } from './tenantMailConfig.mjs';
import { readSecurityAlertPolicy } from './platformSecurityPolicy.mjs';
import { getPostaWsGatewayMetrics } from './postaWsGateway.mjs';
import { getOutboxCounts } from './emailOutbox.mjs';
import { ensurePostaOnboarding } from './postaOnboarding.mjs';

async function allTenantIds(dataDir) {
  const ids = ['main', ...(await listTenantIds(dataDir))];
  return [...new Set(ids.map((id) => String(id).trim()).filter(Boolean))];
}

function businessNameFor(store, tenantId) {
  return (
    String(store?.settings?.businessName ?? '').trim()
    || (tenantId === 'main' ? 'Greenleaf Market' : tenantId)
  );
}

function maskWebhookUrl(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    const path = u.pathname.length > 16 ? `${u.pathname.slice(0, 14)}…` : u.pathname;
    return `${u.protocol}//${u.hostname}${path}`;
  } catch {
    return 'configured';
  }
}

function connectorStatus(ok, configured = true) {
  if (!configured) return 'off';
  return ok ? 'ok' : 'warn';
}

function computeScore(connectors) {
  const critical = connectors.filter((c) => c.priority === 'critical');
  if (!critical.length) return 100;
  const okCount = critical.filter((c) => c.status === 'ok').length;
  const partial = critical.filter((c) => c.status === 'warn').length;
  return Math.round(((okCount + partial * 0.5) / critical.length) * 100);
}

export async function buildPlatformIntegrationsOverview(dataDir) {
  const mailCfg = getEkolojikMailConfig();
  const imapCfg = getEkolojikImapConfig();
  const securityPolicy = await readSecurityAlertPolicy(dataDir);
  const outbox = await getOutboxCounts(dataDir);
  const ws = getPostaWsGatewayMetrics();
  const engagementUrl = process.env.EKOLOJIK_POSTA_ENGAGEMENT_WEBHOOK?.trim() || '';

  const connectors = [
    {
      id: 'smtp',
      category: 'mail',
      label: 'Ekolojik SMTP',
      priority: 'critical',
      status: connectorStatus(isEkolojikSmtpConfigured(), true),
      detail: isEkolojikSmtpConfigured()
        ? `${mailCfg.smtpHost || '—'} · ops ${getEkolojikOpsEmail() || '—'}`
        : 'Sunucu SMTP yapılandırması eksik',
    },
    {
      id: 'imap',
      category: 'mail',
      label: 'Gelen posta (IMAP)',
      priority: 'critical',
      status: connectorStatus(isEkolojikImapConfigured(), true),
      detail: isEkolojikImapConfigured()
        ? `${imapCfg.imapHost || '—'} · ${imapCfg.imapUser || '—'}`
        : 'IMAP yapılandırılmadı',
    },
    {
      id: 'lerta',
      category: 'bridge',
      label: 'Lerta platform köprüsü',
      priority: 'optional',
      status: isLertaPlatformConfigured() ? 'ok' : 'off',
      detail: isLertaPlatformConfigured()
        ? 'LERTA_PLATFORM_API_URL + API key aktif'
        : 'Kapalı veya env eksik',
    },
    {
      id: 'mail_track',
      category: 'analytics',
      label: 'Mail açılma takibi',
      priority: 'optional',
      status: isMailTrackEnabled() ? 'ok' : 'off',
      detail: isMailTrackEnabled() ? 'Açık izleme aktif' : 'EKOLOJIK_MAIL_TRACK kapalı',
    },
    {
      id: 'click_track',
      category: 'analytics',
      label: 'Tıklama takibi',
      priority: 'optional',
      status: isClickTrackEnabled() ? 'ok' : 'off',
      detail: isClickTrackEnabled() ? 'Click track aktif' : 'Kapalı',
    },
    {
      id: 'messaging_public',
      category: 'messaging',
      label: 'Müşteri mesaj API (main)',
      priority: 'critical',
      status: connectorStatus(await isMessagingPublicApiConfigured(dataDir, 'main'), true),
      detail: (await isMessagingPublicApiConfigured(dataDir, 'main'))
        ? 'Embed / public key hazır'
        : 'Ana kiracı için public key yok',
    },
    {
      id: 'posta_ws',
      category: 'realtime',
      label: 'Posta WebSocket',
      priority: 'optional',
      status: 'ok',
      detail: `${ws.path} · ${ws.connectedClients} bağlı istemci`,
    },
  ];

  const webhooks = [
    {
      id: 'security_alerts',
      label: 'Güvenlik uyarı webhook',
      configured: Boolean(securityPolicy.webhookUrl?.trim()),
      enabled: securityPolicy.enabled,
      urlMasked: maskWebhookUrl(securityPolicy.webhookUrl),
      source: 'platform/security-alerts.json',
    },
    {
      id: 'engagement',
      label: 'Posta engagement webhook',
      configured: engagementWebhookConfigured(),
      enabled: engagementWebhookConfigured(),
      urlMasked: maskWebhookUrl(engagementUrl),
      source: 'EKOLOJIK_POSTA_ENGAGEMENT_WEBHOOK',
    },
  ];

  const tenants = [];
  for (const tenantId of await allTenantIds(dataDir)) {
    const store = await readTenantStore(dataDir, tenantId);
    const businessName = businessNameFor(store, tenantId);
    const mailHub = await getTenantMailConfigHub(dataDir, tenantId);
    const messagingKey = await resolveEffectiveMessagingPublicKey(dataDir, tenantId);
    const onboarding = store
      ? ensurePostaOnboarding(store.settings, store.settings?.tenantMeta?.email)
      : null;

    tenants.push({
      tenantId,
      businessName,
      mailMode: mailHub.usePlatformEnv ? 'platform' : 'custom',
      smtpConfigured: Boolean(mailHub.smtp?.host || mailHub.usePlatformEnv),
      imapConfigured: await isTenantImapConfigured(dataDir, tenantId),
      messagingPublicKey: maskMessagingPublicKey(messagingKey.key),
      messagingKeySource: messagingKey.source,
      mailHealthDone: Boolean(onboarding?.steps?.mailHealth?.done),
      messagingEmbedDone: Boolean(
        onboarding?.steps?.messagingEmbed?.done || onboarding?.steps?.messagingEmbed?.skipped,
      ),
    });
  }

  tenants.sort((a, b) => a.businessName.localeCompare(b.businessName, 'tr'));

  return {
    generatedAt: new Date().toISOString(),
    score: computeScore(connectors),
    connectors,
    webhooks,
    realtime: ws,
    outbox: {
      pending: outbox.pending ?? 0,
      failed: outbox.failed ?? 0,
      sent: outbox.sent ?? 0,
    },
    tenants,
  };
}

async function probeSecurityWebhook(url) {
  const trimmed = String(url ?? '').trim();
  if (!trimmed) return { ok: false, skipped: true, error: 'Webhook URL yok' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(trimmed, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'ekolojik-platform',
        event: 'integration_probe',
        at: new Date().toISOString(),
        test: true,
      }),
      signal: controller.signal,
    });
    return { ok: res.ok, status: res.status };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Webhook başarısız' };
  } finally {
    clearTimeout(timer);
  }
}

export async function runPlatformIntegrationProbes(dataDir, options = {}) {
  const { runInfrastructureProbes } = await import('./platformInfrastructureMetrics.mjs');
  const probes = {};

  if (options.smtp || options.imap) {
    const infra = await runInfrastructureProbes(dataDir, {
      smtp: options.smtp === true,
      imap: options.imap === true,
    });
    if (options.smtp) probes.smtp = infra.probes?.smtp ?? null;
    if (options.imap) probes.imap = infra.probes?.imap ?? null;
  }

  if (options.engagementWebhook) {
    probes.engagementWebhook = await fireEngagementWebhook('integration_probe', { test: true });
  }

  if (options.securityWebhook) {
    const policy = await readSecurityAlertPolicy(dataDir);
    probes.securityWebhook = await probeSecurityWebhook(policy.webhookUrl);
  }

  return { ok: true, probes, at: new Date().toISOString() };
}

export function buildPlatformIntegrationsCsv(overview) {
  const lines = [
    'tenantId,businessName,mailMode,smtpConfigured,imapConfigured,messagingPublicKey,messagingKeySource,mailHealthDone,messagingEmbedDone',
  ];
  for (const t of overview.tenants ?? []) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    lines.push(
      [
        t.tenantId,
        esc(t.businessName),
        t.mailMode,
        t.smtpConfigured,
        t.imapConfigured,
        esc(t.messagingPublicKey),
        t.messagingKeySource ?? '',
        t.mailHealthDone,
        t.messagingEmbedDone,
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
