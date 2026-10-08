import { appendMessagingMessage, patchMessagingThread } from './store.mjs';
import { getMessagingBotHub } from './botConfig.mjs';

const DEFAULT_FAQ = [
  {
    id: 'hours',
    patterns: ['çalışma saati', 'calisma saati', 'kaça kadar', 'açık mı', 'acik mi'],
    reply:
      'Çalışma saatlerimiz hafta içi 09:00–18:00 arasındadır. Hafta sonu siparişleriniz bir sonraki iş günü işleme alınır.',
  },
  {
    id: 'shipping',
    patterns: ['kargo', 'teslimat', 'ne zaman gelir', 'gönderim', 'gonderim'],
    reply:
      'Siparişleriniz onaylandıktan sonra 1–3 iş günü içinde kargoya verilir. Takip numaranız e-posta ile paylaşılır.',
  },
  {
    id: 'return',
    patterns: ['iade', 'değişim', 'degisim', 'geri gönder', 'geri gonder'],
    reply:
      'Ürünü teslim aldığınız tarihten itibaren 14 gün içinde iade talebi oluşturabilirsiniz. Detay için sipariş numaranızı paylaşın.',
  },
  {
    id: 'order',
    patterns: ['sipariş durumu', 'siparis durumu', 'siparişim nerede', 'siparisim nerde'],
    reply:
      'Sipariş durumunuzu görmek için sipariş numaranızı veya kayıtlı e-posta adresinizi yazabilirsiniz; operatörümüz kontrol edecektir.',
  },
];

const DEFAULT_HANDOFF = [
  'operatör',
  'operator',
  'insan',
  'yetkili',
  'temsilci',
  'canlı destek',
  'canli destek',
  'şikayet',
  'sikayet',
];

function normalizeText(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function matchFaq(text) {
  const hay = normalizeText(text);
  for (const entry of DEFAULT_FAQ) {
    if (entry.patterns.some((p) => hay.includes(normalizeText(p)))) {
      return entry;
    }
  }
  return null;
}

function wantsHandoff(text, extraKeywords = []) {
  const hay = normalizeText(text);
  const keys = [...DEFAULT_HANDOFF, ...extraKeywords];
  return keys.some((k) => hay.includes(normalizeText(k)));
}

/**
 * Müşteri mesajından sonra FAQ yanıtı veya operatöre devir.
 * @returns {{ bot?: { action: string } }}
 */
export async function runMessagingBotAfterCustomerMessage(dataDir, tenantId, thread, customerMessage) {
  const hub = await getMessagingBotHub(dataDir, tenantId);
  if (!hub.bot?.enabled) return { skipped: true, reason: 'bot_disabled' };
  if (thread.botHandoff) return { skipped: true, reason: 'handoff_done' };
  if (thread.status === 'closed') return { skipped: true, reason: 'closed' };
  if (thread.assignedUserId) return { skipped: true, reason: 'assigned' };

  const body = customerMessage?.bodyText ?? '';
  const handoffKeys = Array.isArray(hub.bot.handoffKeywords) ? hub.bot.handoffKeywords : [];

  if (wantsHandoff(body, handoffKeys)) {
    await patchMessagingThread(dataDir, tenantId, thread.id, {
      botHandoff: true,
      status: 'waiting',
    });
    await appendMessagingMessage(dataDir, tenantId, thread.id, {
      bodyText:
        'Talebinizi operatörümüze aktardık. En kısa sürede size dönüş yapılacaktır. Teşekkür ederiz.',
      direction: 'staff',
      authorName: 'Asistan',
      messageKind: 'bot',
    });
    return { ok: true, bot: { action: 'handoff' } };
  }

  const faq = matchFaq(body);
  if (faq) {
    await appendMessagingMessage(dataDir, tenantId, thread.id, {
      bodyText: faq.reply,
      direction: 'staff',
      authorName: 'Asistan',
      messageKind: 'bot',
    });
    return { ok: true, bot: { action: 'faq', faqId: faq.id } };
  }

  await patchMessagingThread(dataDir, tenantId, thread.id, { status: 'waiting' });
  await appendMessagingMessage(dataDir, tenantId, thread.id, {
    bodyText:
      'Mesajınız için teşekkürler. Sorunuzu operatörümüze ilettik; kısa süre içinde yanıt vereceğiz. Acil durumda "operatör" yazabilirsiniz.',
    direction: 'staff',
    authorName: 'Asistan',
    messageKind: 'bot',
  });
  return { ok: true, bot: { action: 'fallback_waiting' } };
}
