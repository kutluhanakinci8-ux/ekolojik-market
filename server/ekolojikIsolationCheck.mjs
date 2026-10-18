import { isLertaPlatformConfigured } from './lertaPlatformBridge.mjs';
import { isEkolojikSmtpConfigured, getEkolojikOpsEmail, getEkolojikSmtpHostHint, isEkolojikImapConfigured } from './ekolojikMailConfig.mjs';
import { getOutboxCounts } from './emailOutbox.mjs';

/** Faz 5 — Ekolojik / NB ayrımı ve operasyon özeti (salt okunur) */
export async function getEkolojikIsolationReport(dataDir) {
  const lertaBridge = isLertaPlatformConfigured();
  const counts = await getOutboxCounts(dataDir);

  const checks = [
    {
      id: 'lerta_bridge_off',
      label: 'NB köprüsü kapalı (üretim hedefi)',
      ok: !lertaBridge,
      detail: lertaBridge
        ? 'LERTA_PLATFORM_BRIDGE veya API anahtarı aktif — Ekolojik-only için kapatın'
        : 'LERTA_PLATFORM_BRIDGE=0 veya API yok',
    },
    {
      id: 'ekolojik_smtp',
      label: 'Ekolojik giden posta (SMTP env)',
      ok: isEkolojikSmtpConfigured(),
      detail: isEkolojikSmtpConfigured() ? 'EKOLOJIK_SMTP_* yapılandırıldı' : 'EKOLOJIK_SMTP_HOST + EKOLOJIK_MAIL_FROM',
    },
    {
      id: 'ops_email',
      label: 'Operasyon / iletişim bildirimi',
      ok: Boolean(getEkolojikOpsEmail()?.includes('@')),
      detail: getEkolojikOpsEmail() || 'EKOLOJIK_OPS_EMAIL',
    },
    {
      id: 'ekolojik_imap',
      label: 'Posta Gelen IMAP (Faz 7)',
      ok: isEkolojikImapConfigured(),
      detail: isEkolojikImapConfigured() ? 'EKOLOJIK_IMAP_* yapılandırıldı' : 'Hub Gelen sync için IMAP gerekli',
    },
    {
      id: 'smtp_host_sane',
      label: 'SMTP host (Faz 6)',
      ok: !getEkolojikSmtpHostHint()?.includes('VPS IP'),
      detail: getEkolojikSmtpHostHint() || 'mail.ekolojikmarket.com.tr veya relay',
    },
    {
      id: 'nb_inbound_mx',
      label: 'NB inbound MX kullanılmıyor',
      ok: true,
      detail: 'Fatura IMAP yalnızca Ekolojik billEmailClient (Faz 4)',
    },
    {
      id: 'outbox_failed',
      label: 'Outbox hatalı kuyruk',
      ok: (counts.failed ?? 0) === 0,
      detail: `pending=${counts.pending} sent=${counts.sent} failed=${counts.failed}`,
    },
  ];

  return {
    ok: checks.every((c) => c.ok || c.id === 'ekolojik_smtp' || c.id === 'ekolojik_imap'),
    checks,
    dataPaths: [
      'data/email-outbox/',
      'data/messaging/',
      'data/bill-email-inbox/',
      'data/messaging-attachments/',
      'data/contact-messages.json',
      'data/posta-mail-settings.json',
      'data/posta-inbox/',
    ],
    envHints: [
      'EKOLOJIK_* — giden posta, ops, IMAP',
      'LERTA_PLATFORM_* — yalnızca bilinçli test; üretimde kapalı',
      'MAIL_PLATFORM_* — Nakliye Borsası; Ekolojik VPS ile karıştırmayın',
    ],
  };
}
