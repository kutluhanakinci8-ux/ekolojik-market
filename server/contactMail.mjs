import { getEkolojikMailConfig } from './ekolojikMailConfig.mjs';
import { sendEkolojikMail } from './emailOutboxProcessor.mjs';
import { appendCustomerTrackingNotice } from './postaCustomerEmailCompliance.mjs';
import { getEffectiveMailPresentation, shouldSendPostaNotification } from './postaSettings.mjs';

const SUBJECT_LABELS = {
  genel: 'Genel',
  siparis: 'Sipariş',
  bayi: 'Bayi / Toptan',
  sikayet: 'Şikayet',
  diger: 'Diğer',
};

function subjectLabel(code) {
  const key = String(code ?? 'genel').trim().toLowerCase();
  return SUBJECT_LABELS[key] ?? code ?? 'Genel';
}

function formatOpsBody(record) {
  const lines = [
    'Yeni iletişim formu mesajı (Ekolojik Market POS)',
    '',
    `Kayıt: ${record.id}`,
    `Tarih: ${record.createdAt}`,
    `Konu: ${subjectLabel(record.subject)} (${record.subject})`,
    `Ad: ${record.name}`,
    `E-posta: ${record.email}`,
  ];
  if (record.phone?.trim()) {
    lines.push(`Telefon: ${record.phone.trim()}`);
  }
  lines.push('', 'Mesaj:', record.message, '', '— Ekolojik outbox (Faz 2)');
  return lines.join('\n');
}

function formatAutoreplyBody(record, portalUrl) {
  const brand = getEkolojikMailConfig().fromName || 'Ekolojik Market';
  const lines = [
    `Sayın ${record.name},`,
    '',
    `${brand} iletişim formundan gönderdiğiniz mesajı aldık.`,
    'Ekibimiz en kısa sürede size dönüş yapacaktır.',
    '',
    'Özet:',
    `- Konu: ${subjectLabel(record.subject)}`,
    `- Referans: ${record.id}`,
  ];
  if (portalUrl) {
    lines.push('', 'Talep durumunu ve yazışmayı buradan takip edebilirsiniz:', portalUrl);
  }
  lines.push('', 'Bu e-posta otomatik gönderilmiştir; lütfen yanıtlamayın.');
  return lines.join('\n');
}

export function isContactAutoreplyEnabled() {
  return process.env.EKOLOJIK_CONTACT_AUTOREPLY === '1';
}

/** İletişim kaydı sonrası operatör bildirimi + isteğe bağlı müşteri otomatik yanıt */
export async function sendContactNotifications(dataDir, record, tenantId = 'main', { portalUrl } = {}) {
  if (!record?.id) {
    return { ok: false, error: 'Geçersiz iletişim kaydı' };
  }

  const pres = await getEffectiveMailPresentation(dataDir, tenantId);
  const opsEmail = pres.opsEmail;
  const summary = { ops: null, autoreply: null, opsSkipped: false, autoreplySkipped: false };

  if (opsEmail?.includes('@') && (await shouldSendPostaNotification(dataDir, 'contact', 'opsEmail', tenantId))) {
    summary.ops = await sendEkolojikMail(dataDir, {
      to: opsEmail,
      subject: `[İletişim] ${subjectLabel(record.subject)} — ${record.name}`,
      body: formatOpsBody(record),
      idempotencyKey: `contact:ops:${record.id}`,
      source: 'contact-ops',
      tenantId,
    });
  } else {
    summary.opsSkipped = true;
  }

  const autoreplyMatrix =
    await shouldSendPostaNotification(dataDir, 'contact', 'customerAutoreply', tenantId);
  if ((isContactAutoreplyEnabled() || autoreplyMatrix) && record.email?.includes('@')) {
    const baseBody = formatAutoreplyBody(record, portalUrl);
    const withNotice = await appendCustomerTrackingNotice(dataDir, tenantId, { text: baseBody, html: null });
    summary.autoreply = await sendEkolojikMail(dataDir, {
      to: record.email,
      subject: 'Ekolojik Market — talebiniz alındı',
      body: withNotice.text,
      html: withNotice.html ?? undefined,
      idempotencyKey: `contact:reply:${record.id}`,
      source: 'contact-autoreply',
      tenantId,
    });
  } else if (!isContactAutoreplyEnabled()) {
    summary.autoreplySkipped = true;
  }

  summary.ok = true;
  return summary;
}
