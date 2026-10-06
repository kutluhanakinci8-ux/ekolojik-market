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
    id: 'randevu',
    label: 'Randevu / görüşme',
    subject: 'Görüşme talebi',
    body: 'Merhaba,\n\nUygun olduğunuz bir zamanı paylaşırsanız sizi arayabilir veya mağazamızda ağırlayabiliriz.\n\nEkolojik Market',
  },
];

export function listMailTemplates() {
  return TEMPLATES.map(({ id, label, subject, body }) => ({ id, label, subject, body }));
}

export function getMailTemplate(id) {
  return TEMPLATES.find((t) => t.id === id) ?? null;
}
