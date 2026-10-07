import { getEkolojikMailConfig } from './ekolojikMailConfig.mjs';
import { sendEkolojikMail } from './emailOutboxProcessor.mjs';
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

function formatAutoreplyBody(record) {
  const brand = getEkolojikMailConfig().fromName || 'Ekolojik Market';
  return [
    `Sayın ${record.name},`,
    '',
    `${brand} iletişim formundan gönderdiğiniz mesajı aldık.`,
    'Ekibimiz en kısa sürede size dönüş yapacaktır.',
    '',
    'Özet:',
    `- Konu: ${subjectLabel(record.subject)}`,
    `- Referans: ${record.id}`,
    '',
    'Bu e-posta otomatik gönderilmiştir; lütfen yanıtlamayın.',
  ].join('\n');
}

export function isContactAutoreplyEnabled() {
  return process.env.EKOLOJIK_CONTACT_AUTOREPLY === '1';
}

/** İletişim kaydı sonrası operatör bildirimi + isteğe bağlı müşteri otomatik yanıt */
export async function sendContactNotifications(dataDir, record) {
  if (!record?.id) {
    return { ok: false, error: 'Geçersiz iletişim kaydı' };
  }

  const pres = await getEffectiveMailPresentation(dataDir);
  const opsEmail = pres.opsEmail;
  const summary = { ops: null, autoreply: null, opsSkipped: false, autoreplySkipped: false };

  if (opsEmail?.includes('@') && (await shouldSendPostaNotification(dataDir, 'contact'))) {
    summary.ops = await sendEkolojikMail(dataDir, {
      to: opsEmail,
      subject: `[İletişim] ${subjectLabel(record.subject)} — ${record.name}`,
      body: formatOpsBody(record),
      idempotencyKey: `contact:ops:${record.id}`,
      source: 'contact-ops',
    });
  } else {
    summary.opsSkipped = true;
  }

  const autoreplyMatrix =
    await shouldSendPostaNotification(dataDir, 'contact', 'customerAutoreply');
  if ((isContactAutoreplyEnabled() || autoreplyMatrix) && record.email?.includes('@')) {
    summary.autoreply = await sendEkolojikMail(dataDir, {
      to: record.email,
      subject: 'Ekolojik Market — talebiniz alındı',
      body: formatAutoreplyBody(record),
      idempotencyKey: `contact:reply:${record.id}`,
      source: 'contact-autoreply',
    });
  } else if (!isContactAutoreplyEnabled()) {
    summary.autoreplySkipped = true;
  }

  summary.ok = true;
  return summary;
}
