/** Hazır e-posta şablonları (Posta hub — Faz 8) */

const TEMPLATES = [
  {
    id: 'tesekkur',
    label: 'Teşekkür',
    subject: 'Ekolojik Market — teşekkürler',
    body: 'Merhaba,\n\nBizimle iletişime geçtiğiniz için teşekkür ederiz.\n\nSaygılarımızla,\nEkolojik Market',
  },
  {
    id: 'siparis-alindi',
    label: 'Sipariş alındı',
    subject: 'Siparişiniz alındı',
    body: 'Merhaba,\n\nSiparişiniz kayda alınmıştır. Hazırlık sürecinde sizi bilgilendireceğiz.\n\nEkolojik Market',
  },
  {
    id: 'stok-bilgi',
    label: 'Stok bilgisi',
    subject: 'Stok / ürün bilgisi',
    body: 'Merhaba,\n\nTalep ettiğiniz ürün hakkında güncel stok bilgisini paylaşmak isteriz:\n\n—\n\nEkolojik Market',
  },
  {
    id: 'kvkk',
    label: 'KVKK yanıt',
    subject: 'KVKK başvurunuz',
    body: 'Sayın ilgili,\n\nKişisel verilerin korunması kapsamındaki talebiniz tarafımıza ulaşmıştır. Yasal süre içinde dönüş yapılacaktır.\n\nEkolojik Market',
  },
  {
    id: 'iade',
    label: 'İade / değişim',
    subject: 'İade veya değişim talebiniz',
    body: 'Merhaba,\n\nİade/değişim talebiniz incelenmektedir. Kısa süre içinde dönüş yapacağız.\n\nEkolojik Market',
  },
  {
    id: 'gecikme',
    label: 'Gecikme özür',
    subject: 'Gecikme hakkında',
    body: 'Merhaba,\n\nYaşanan gecikme için özür dileriz. Siparişinizin durumu hakkında sizi bilgilendirmeye devam edeceğiz.\n\nEkolojik Market',
  },
  {
    id: 'genel-yanit',
    label: 'Genel yanıt',
    subject: 'Ekolojik Market — mesajınız',
    body: 'Merhaba,\n\nMesajınız için teşekkürler. Talebinizle ilgileniyoruz.\n\nSaygılarımızla,\nEkolojik Market',
  },
];

export function listMailTemplates() {
  return TEMPLATES.map(({ id, label, subject, body }) => ({ id, label, subject, body }));
}

export function getMailTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}

/** Müşteriye “yazışmanız var” özet e-postası (Faz 18) */
export function buildMessagingCustomerSummaryEmail({ customerName, subject, bodyText, threadId }) {
  const name = String(customerName ?? 'Müşterimiz').trim();
  const subj = String(subject ?? 'Yazışma').trim();
  const preview = String(bodyText ?? '').trim().slice(0, 500);
  const text = [
    `Sayın ${name},`,
    '',
    'Ekolojik Market ile olan yazışmanızda yeni bir mesaj var.',
    '',
    `Konu: ${subj}`,
    '',
    preview,
    '',
    'Detay için mağazamızla iletişime geçebilir veya size gönderilen kanaldan yanıtlayabilirsiniz.',
    '',
    `Referans: ${threadId ?? '—'}`,
    '',
    '— Ekolojik Market',
  ].join('\n');
  const html = `<div style="font-family:sans-serif;font-size:14px;line-height:1.5">
<p>Sayın ${name},</p>
<p><strong>Yazışmanızda yeni mesaj var.</strong></p>
<p>Konu: ${subj}</p>
<blockquote style="border-left:3px solid #2d6a4f;padding-left:12px;color:#333">${preview.replace(/\n/g, '<br/>')}</blockquote>
<p style="color:#666;font-size:12px">Referans: ${threadId ?? '—'}</p>
</div>`;
  return {
    subject: `Ekolojik Market — yazışmanız var: ${subj}`,
    text,
    html,
  };
}
