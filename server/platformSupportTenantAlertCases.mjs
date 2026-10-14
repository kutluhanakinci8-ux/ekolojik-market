/** Kiracı operasyon uyarıları → destek incident case (ödeme, stok vb.) */

import { createPlatformCase, findCaseByLink } from './platformCaseStore.mjs';

export function isTenantAlertCaseSpawnEnabled() {
  const flag = process.env.EKOLOJIK_SUPPORT_TENANT_ALERT_CASE?.trim();
  return flag === '1' || flag === 'true';
}

export async function maybeSpawnCasesForTenantAlerts(dataDir, tenantAlerts) {
  if (!isTenantAlertCaseSpawnEnabled()) {
    return { ok: true, spawned: 0, skipped: true, reason: 'disabled' };
  }
  if (!Array.isArray(tenantAlerts) || !tenantAlerts.length) {
    return { ok: true, spawned: 0 };
  }

  let spawned = 0;
  for (const row of tenantAlerts) {
    const tenantId = String(row.tenantId ?? '').trim();
    if (!tenantId) continue;
    for (const alert of row.alerts ?? []) {
      const kind = String(alert.kind ?? '').trim();
      if (!kind || !['payment_overdue', 'low_stock'].includes(kind)) continue;
      const alertKind = `tenant:${tenantId}:${kind}`;
      const existing = await findCaseByLink(dataDir, { alertKind });
      if (existing) continue;

      const severity = String(alert.severity ?? '').toLowerCase();
      const priority = severity === 'warning' || severity === 'high' ? 'high' : 'normal';
      const result = await createPlatformCase(
        dataDir,
        {
          kind: 'incident',
          channel: 'alert',
          status: 'new',
          priority,
          tenantId,
          businessName: row.businessName ?? tenantId,
          subject: String(alert.title ?? alert.message ?? 'Kiracı uyarısı').slice(0, 200),
          notes: String(alert.message ?? ''),
          links: { alertKind, tenantId },
          tags: ['tenant-alert', kind, 'auto'],
        },
        'system',
      );
      if (result.ok && !result.duplicate) spawned += 1;
    }
  }

  return { ok: true, spawned };
}
