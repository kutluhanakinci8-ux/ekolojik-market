/** Platform destek — SLA / kuyruk ops@ özet bildirimi (cron ile) */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { buildPlatformSupportSlaLive } from './platformSupportSlaLive.mjs';
import { readPlatformCases } from './platformCaseStore.mjs';
import { getEkolojikOpsEmail } from './ekolojikMailConfig.mjs';
import { getPlatformSupportMailPresentation } from './platformSupportMailConfig.mjs';
import { sendViaEkolojikSmtp } from './ekolojikSmtp.mjs';
import { PLATFORM_TENANT_ID } from './platformOperators.mjs';
import { publicSiteUrl } from './platformSupportMailBrand.mjs';
import { isSupportOpsNotifyEnabled } from './platformSupportOpsNotify.mjs';

const STATE_PATH = (dataDir) => join(dataDir, 'platform', 'support-ops-sla-alert-state.json');
const MIN_INTERVAL_MS = 4 * 60 * 60 * 1000;

export function isSupportOpsSlaNotifyEnabled() {
  const flag = process.env.EKOLOJIK_SUPPORT_OPS_SLA_NOTIFY?.trim();
  if (flag === '0' || flag === 'false') return false;
  return isSupportOpsNotifyEnabled();
}

function platformConsoleUrl() {
  return `${publicSiteUrl().replace(/\/$/, '')}/platform`;
}

function formatWait(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 48) return `${Math.floor(h / 24)} gün`;
  if (h > 0) return `${h} sa ${m} dk`;
  return `${m} dk`;
}

function buildFingerprint({ caseOverdue, queueBySeverity, pendingFirstResponse }) {
  return `${caseOverdue}|${queueBySeverity.critical}|${queueBySeverity.warning}|${pendingFirstResponse}`;
}

async function readAlertState(dataDir) {
  try {
    return JSON.parse(await readFile(STATE_PATH(dataDir), 'utf8'));
  } catch {
    return {};
  }
}

async function writeAlertState(dataDir, state) {
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(STATE_PATH(dataDir), JSON.stringify(state, null, 2), 'utf8');
}

function shouldSendAlert(state, fingerprint, hasUrgent) {
  if (!hasUrgent) return false;
  const lastAt = Date.parse(state?.lastAlertAt ?? '');
  const sameFingerprint = state?.lastFingerprint === fingerprint;
  if (!Number.isFinite(lastAt)) return true;
  if (!sameFingerprint) return true;
  return Date.now() - lastAt >= MIN_INTERVAL_MS;
}

export async function evaluateAndNotifyOpsSupportSla(dataDir) {
  if (!isSupportOpsSlaNotifyEnabled()) {
    return { skipped: true, reason: 'disabled' };
  }

  const live = await buildPlatformSupportSlaLive(dataDir, { days: 7 });
  const { critical = 0, warning = 0 } = live.queueBySeverity ?? {};
  const caseOverdue = live.caseOverdue ?? 0;
  const pending = live.totals?.pendingFirstResponse ?? 0;

  const hasUrgent = caseOverdue > 0 || critical > 0 || warning > 0;
  const fingerprint = buildFingerprint({
    caseOverdue,
    queueBySeverity: live.queueBySeverity ?? { critical: 0, warning: 0 },
    pendingFirstResponse: pending,
  });

  const state = await readAlertState(dataDir);
  if (!shouldSendAlert(state, fingerprint, hasUrgent)) {
    return { ok: true, sent: false, reason: hasUrgent ? 'rate_limited' : 'nothing_urgent' };
  }

  const to = getEkolojikOpsEmail();
  if (!to?.includes('@')) return { skipped: true, reason: 'no_ops_email' };

  const cases = await readPlatformCases(dataDir);
  const now = Date.now();
  const overdueCases = cases
    .filter((c) => !['solved', 'closed'].includes(c.status) && c.slaDueAt && Date.parse(c.slaDueAt) < now)
    .slice(0, 8);

  const topQueue = (live.topQueue ?? []).filter((q) => q.severity === 'critical' || q.severity === 'warning').slice(0, 10);

  const lines = [
    'Platform destek — SLA / kuyruk özeti',
    '',
    `Kayıt SLA gecikmesi: ${caseOverdue}`,
    `Kuyruk: ${critical} kritik, ${warning} uyarı`,
    `İlk yanıt bekleyen thread: ${pending}`,
    `Uyum (pencere): ${live.compliancePercent != null ? `${live.compliancePercent}%` : '—'}`,
    '',
    'Öncelikli kuyruk:',
  ];

  if (topQueue.length === 0) {
    lines.push('— (kritik/uyarı yok)');
  } else {
    for (const q of topQueue) {
      lines.push(
        `- [${q.severity}] ${q.businessName} · ${q.kind === 'first_response' ? 'İlk yanıt' : 'Eski bekleme'} · ${q.customerName} · ${formatWait(q.waitMs)}`,
      );
    }
  }

  if (overdueCases.length) {
    lines.push('', 'Geciken kayıtlar:');
    for (const c of overdueCases) {
      lines.push(`- #${c.number} ${c.status} · ${c.subject || '—'} · SLA ${c.slaDueAt}`);
    }
  }

  lines.push('', `Konsol: ${platformConsoleUrl()} → Destek`);

  const queueHtml = topQueue.length
    ? `<ul>${topQueue
      .map(
        (q) =>
          `<li><strong>${q.severity}</strong> ${q.businessName} — ${q.kind === 'first_response' ? 'İlk yanıt' : 'Eski bekleme'} — ${q.customerName} (${formatWait(q.waitMs)})</li>`,
      )
      .join('')}</ul>`
    : '<p>Kritik/uyarı kuyruk öğesi yok.</p>';

  const casesHtml = overdueCases.length
    ? `<ul>${overdueCases.map((c) => `<li>#${c.number} ${c.status} — ${c.subject || '—'}</li>`).join('')}</ul>`
    : '';

  const pres = getPlatformSupportMailPresentation();
  const subject = `[Platform Destek] SLA — ${critical} kritik, ${caseOverdue} geciken kayıt`;
  const html = `<!DOCTYPE html><html lang="tr"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a2e1a;">
<h2>SLA / kuyruk özeti</h2>
<p>Kayıt gecikmesi: <strong>${caseOverdue}</strong> · Kuyruk: <strong>${critical}</strong> kritik, <strong>${warning}</strong> uyarı</p>
<h3>Öncelik</h3>${queueHtml}
${casesHtml ? `<h3>Geciken kayıtlar</h3>${casesHtml}` : ''}
<p><a href="${platformConsoleUrl()}">Platform konsolu</a></p>
</body></html>`;

  const result = await sendViaEkolojikSmtp({
    dataDir,
    tenantId: PLATFORM_TENANT_ID,
    to,
    subject,
    text: lines.join('\n'),
    html,
    fromEmail: pres.from,
    fromName: pres.fromName || 'Ekolojik Destek',
    replyTo: pres.replyTo,
  });

  if (result?.messageId) {
    await writeAlertState(dataDir, {
      lastAlertAt: new Date().toISOString(),
      lastFingerprint: fingerprint,
    });
  }

  return {
    ok: Boolean(result?.messageId),
    sent: Boolean(result?.messageId),
    messageId: result?.messageId,
    caseOverdue,
    critical,
    warning,
  };
}
