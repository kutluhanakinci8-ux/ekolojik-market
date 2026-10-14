/** Platform güvenlik eşik uyarıları → isteğe bağlı destek incident case */

import { createPlatformCase, findCaseByLink } from './platformCaseStore.mjs';

export function isSecurityAlertCaseSpawnEnabled() {
  const flag = process.env.EKOLOJIK_SUPPORT_ALERT_CASE?.trim();
  return flag === '1' || flag === 'true';
}

export async function maybeSpawnCasesForSecurityAlerts(dataDir, alerts) {
  if (!isSecurityAlertCaseSpawnEnabled()) {
    return { ok: true, spawned: 0, skipped: true, reason: 'disabled' };
  }
  if (!Array.isArray(alerts) || !alerts.length) {
    return { ok: true, spawned: 0 };
  }

  let spawned = 0;
  for (const alert of alerts) {
    const alertKind = String(alert?.id ?? '').trim();
    if (!alertKind) continue;
    const existing = await findCaseByLink(dataDir, { alertKind });
    if (existing) continue;

    const severity = String(alert.severity ?? '').toLowerCase();
    const priority = severity === 'high' || severity === 'critical' ? 'high' : 'normal';
    const result = await createPlatformCase(
      dataDir,
      {
        kind: 'incident',
        channel: 'alert',
        status: 'new',
        priority,
        subject: String(alert.title ?? 'Platform güvenlik uyarısı').slice(0, 200),
        notes: String(alert.detail ?? ''),
        links: { alertKind },
        tags: ['security-alert', 'auto'],
      },
      'system',
    );
    if (result.ok && !result.duplicate) spawned += 1;
  }

  return { ok: true, spawned };
}
