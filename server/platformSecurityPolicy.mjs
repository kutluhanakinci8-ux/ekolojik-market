import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const POLICY_PATH = (dataDir) => join(dataDir, 'platform', 'security-alerts.json');

export const DEFAULT_SECURITY_ALERT_POLICY = {
  enabled: true,
  emailOps: true,
  webhookUrl: '',
  cooldownMinutes: 360,
  thresholds: {
    failedLogins24h: 12,
    securityScoreBelow: 50,
    highRecommendations: 2,
  },
  lastFired: {},
};

export async function readSecurityAlertPolicy(dataDir) {
  try {
    const raw = JSON.parse(await readFile(POLICY_PATH(dataDir), 'utf8'));
    return {
      ...DEFAULT_SECURITY_ALERT_POLICY,
      ...raw,
      thresholds: {
        ...DEFAULT_SECURITY_ALERT_POLICY.thresholds,
        ...(raw.thresholds ?? {}),
      },
      lastFired: raw.lastFired ?? {},
    };
  } catch {
    return { ...DEFAULT_SECURITY_ALERT_POLICY, lastFired: {} };
  }
}

export async function writeSecurityAlertPolicy(dataDir, policy) {
  const merged = {
    ...DEFAULT_SECURITY_ALERT_POLICY,
    ...policy,
    thresholds: {
      ...DEFAULT_SECURITY_ALERT_POLICY.thresholds,
      ...(policy.thresholds ?? {}),
    },
    updatedAt: new Date().toISOString(),
  };
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(POLICY_PATH(dataDir), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}
