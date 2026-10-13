/** Platform — yapılandırma merkezi (runtime + operatör ayarları) */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getTenantAllowlist,
  isStrictTenantAllowlistEnabled,
  isPublicTenantRegistrationEnabled,
} from './tenantAllowlist.mjs';
import { readPlatformOperatorsMeta } from './platformAuth.mjs';
import { readSecurityAlertPolicy } from './platformSecurityPolicy.mjs';
import { readSupportSlaPolicy } from './platformSupportPolicy.mjs';
import { readPlatformSessionEpoch } from './platformSessionRevoke.mjs';
import {
  readConsoleSettings,
  listPlanMrrCatalog,
} from './platformConsoleSettings.mjs';
import { isMailTrackEnabled } from './postaMailTrack.mjs';
import { isClickTrackEnabled, engagementWebhookConfigured } from './postaEngagement.mjs';
import { isMessagingPublicApiConfigured } from './messaging/publicConfig.mjs';

function maskEmail(email) {
  const e = String(email ?? '').trim();
  if (!e.includes('@')) return null;
  const [local, domain] = e.split('@');
  if (local.length <= 2) return `**@${domain}`;
  return `${local.slice(0, 2)}***@${domain}`;
}

function envFlag(name) {
  const v = String(process.env[name] ?? '').trim();
  if (!v) return null;
  return v.length > 80 ? `${v.slice(0, 40)}…` : v;
}

async function registrationCount(dataDir) {
  try {
    const raw = JSON.parse(await readFile(join(dataDir, 'registrations.json'), 'utf8'));
    return Array.isArray(raw) ? raw.length : 0;
  } catch {
    return 0;
  }
}

export async function buildPlatformSettingsOverview(dataDir) {
  const [
    allowlist,
    operatorsMeta,
    securityPolicy,
    supportPolicy,
    consoleSettings,
    sessionEpoch,
    registrations,
  ] = await Promise.all([
    getTenantAllowlist(),
    readPlatformOperatorsMeta(dataDir),
    readSecurityAlertPolicy(dataDir),
    readSupportSlaPolicy(dataDir),
    readConsoleSettings(dataDir),
    readPlatformSessionEpoch(dataDir),
    registrationCount(dataDir),
  ]);

  const allowlistSource = process.env.EKOLOJIK_TENANT_ALLOWLIST?.trim() ? 'env' : 'config';

  return {
    generatedAt: new Date().toISOString(),
    runtime: {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      strictTenantAllowlist: isStrictTenantAllowlistEnabled(),
      publicRegistrationEnabled: isPublicTenantRegistrationEnabled(),
      allowlist,
      allowlistSource,
      registrationCount: registrations,
      platformSessionEpoch: sessionEpoch,
    },
    integrations: {
      mailTrackEnabled: isMailTrackEnabled(),
      clickTrackEnabled: isClickTrackEnabled(),
      engagementWebhookConfigured: engagementWebhookConfigured(),
      messagingPublicApiConfigured: isMessagingPublicApiConfigured(),
      smtpHost: envFlag('EKOLOJIK_SMTP_HOST') ?? envFlag('SMTP_HOST'),
      publicRegisterEnv: envFlag('EKOLOJIK_PUBLIC_REGISTER'),
      tenantStrictEnv: envFlag('EKOLOJIK_TENANT_STRICT'),
    },
    operators: (operatorsMeta.operators ?? []).map((o) => ({
      username: o.username,
      displayName: o.displayName ?? o.username,
      recoveryEmailMasked: maskEmail(o.recoveryEmail),
      updatedAt: o.updatedAt ?? null,
    })),
    policies: {
      securityAlerts: {
        enabled: securityPolicy.enabled,
        emailOps: securityPolicy.emailOps,
        webhookConfigured: Boolean(String(securityPolicy.webhookUrl ?? '').trim()),
        cooldownMinutes: securityPolicy.cooldownMinutes,
        thresholds: securityPolicy.thresholds,
      },
      supportSla: {
        firstResponseTargetMinutes: supportPolicy.firstResponseTargetMinutes,
        staleWaitingHours: supportPolicy.staleWaitingHours,
      },
    },
    console: consoleSettings,
    planMrrCatalog: listPlanMrrCatalog(consoleSettings.planMrrTryOverrides ?? {}),
  };
}
