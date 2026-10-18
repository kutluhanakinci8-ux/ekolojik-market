/** Platform destek — operasyon (ops@) iç bildirimleri */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getEkolojikOpsEmail } from './ekolojikMailConfig.mjs';
import { getPlatformSupportMailPresentation } from './platformSupportMailConfig.mjs';
import { sendViaEkolojikSmtp } from './ekolojikSmtp.mjs';
import { PLATFORM_TENANT_ID } from './platformOperators.mjs';
import { publicSiteUrl } from './platformSupportMailBrand.mjs';

const IMAP_ALERT_STATE = (dataDir) => join(dataDir, 'platform', 'support-imap-sync-alert-state.json');
const IMAP_ALERT_MIN_INTERVAL_MS = 60 * 60 * 1000;

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

export function isSupportImapSyncAlertEnabled() {
  const flag = process.env.EKOLOJIK_SUPPORT_IMAP_SYNC_ALERT?.trim();
  if (flag === '0' || flag === 'false') return false;
  return isSupportOpsNotifyEnabled();
}

async function shouldSendImapSyncAlert(dataDir) {
  try {
    const raw = JSON.parse(await readFile(IMAP_ALERT_STATE(dataDir), 'utf8'));
    const last = Date.parse(raw?.lastAlertAt ?? '');
    if (Number.isFinite(last) && Date.now() - last < IMAP_ALERT_MIN_INTERVAL_MS) {
      return false;
    }
  } catch {
    /* ilk uyarı */
  }
  return true;
}

async function markImapSyncAlertSent(dataDir) {
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(
    IMAP_ALERT_STATE(dataDir),
    JSON.stringify({ lastAlertAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
}

export async function notifyOpsSupportImapSyncFailure(dataDir, { error }) {
  if (!isSupportImapSyncAlertEnabled()) return { skipped: true, reason: 'disabled' };
  if (!(await shouldSendImapSyncAlert(dataDir))) {
    return { skipped: true, reason: 'rate_limited' };
  }
  const to = getEkolojikOpsEmail();
  if (!to?.includes('@')) return { skipped: true, reason: 'no_ops_email' };

  const pres = getPlatformSupportMailPresentation();
  const subject = '[Platform Destek] destek@ IMAP senkron hatası';
  const detail = String(error ?? 'Bilinmeyen hata').slice(0, 2000);
  const text = [
    'Platform destek gelen kutusu senkronu başarısız.',
    '',
    detail,
    '',
    `Log: /var/log/ekolojik-support-inbox-sync.log`,
    `Konsol: ${platformConsoleUrl()} → Destek → Gelen kutusu`,
    '',
    'Kapatma: EKOLOJIK_SUPPORT_IMAP_SYNC_ALERT=0',
  ].join('\n');

  const html = `<!DOCTYPE html><html lang="tr"><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a2e1a;">
<p><strong>destek@ IMAP senkron</strong> başarısız.</p>
<pre style="white-space:pre-wrap;background:#f3f6f4;padding:12px;border-radius:8px;">${detail.replace(/</g, '&lt;')}</pre>
<p><a href="${platformConsoleUrl()}">Platform konsolu</a> → Destek</p>
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

  if (result?.messageId) await markImapSyncAlertSent(dataDir);
  return { ok: Boolean(result?.messageId), messageId: result?.messageId, to };
}
