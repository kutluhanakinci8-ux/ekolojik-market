/** Platform destek — operasyon (ops@) iç bildirimleri */

import { getEkolojikOpsEmail } from './ekolojikMailConfig.mjs';
import { getPlatformSupportMailPresentation } from './platformSupportMailConfig.mjs';
import { sendViaEkolojikSmtp } from './ekolojikSmtp.mjs';
import { PLATFORM_TENANT_ID } from './platformOperators.mjs';
import { publicSiteUrl } from './platformSupportMailBrand.mjs';

export function isSupportOpsNotifyEnabled() {
  const flag = process.env.EKOLOJIK_SUPPORT_OPS_NOTIFY?.trim();
  if (flag === '0' || flag === 'false') return false;
  return true;
}

function platformConsoleUrl() {
  const base = publicSiteUrl().replace(/\/$/, '');
  return `${base}/platform`;
}

export async function notifyOpsSpawnedSupportCase(dataDir, { closedCase, newCase, inboxRow }) {
  if (!isSupportOpsNotifyEnabled()) return { skipped: true, reason: 'disabled' };
  const to = getEkolojikOpsEmail();
  if (!to?.includes('@')) return { skipped: true, reason: 'no_ops_email' };

  const pres = getPlatformSupportMailPresentation();
  const subject = `[Platform Destek] new_case — kayıt #${newCase.number} (eski #${closedCase.number})`;
  const text = [
    'Platform destek — kapalı kayda gelen mail yeni kayıt olarak açıldı.',
    '',
    `Kapalı kayıt: #${closedCase.number} (${closedCase.status}) — ${closedCase.subject || ''}`,
    `Yeni kayıt: #${newCase.number} — ${newCase.subject || ''}`,
    `Talep referansı: ${inboxRow?.id ?? newCase.links?.inboxMessageId ?? '—'}`,
    `Gönderen: ${inboxRow?.from ?? newCase.requesterEmail ?? '—'}`,
    `Konu: ${inboxRow?.subject ?? '—'}`,
    '',
    `Platform konsolu: ${platformConsoleUrl()}`,
    'Sekme: Destek → Kayıtlar',
  ].join('\n');

  const html = `<!DOCTYPE html><html lang="tr"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a2e1a;">
<p><strong>Platform destek</strong> — <code>new_case</code> politikası</p>
<ul>
  <li>Kapalı kayıt: <strong>#${closedCase.number}</strong> (${closedCase.status})</li>
  <li>Yeni kayıt: <strong>#${newCase.number}</strong></li>
  <li>Referans: <code>${inboxRow?.id ?? ''}</code></li>
  <li>Gönderen: ${inboxRow?.from ?? newCase.requesterEmail ?? '—'}</li>
</ul>
<p><a href="${platformConsoleUrl()}">Platform konsolunu aç</a> → Destek → Kayıtlar</p>
</body></html>`;

  const result = await sendViaEkolojikSmtp({
    dataDir,
    tenantId: PLATFORM_TENANT_ID,
    to,
    subject,
    text,
    html,
    fromEmail: pres.from,
    fromName: pres.fromName || 'Ekolojik Destek',
    replyTo: pres.replyTo,
  });

  return { ok: Boolean(result?.messageId), messageId: result?.messageId, to };
}
