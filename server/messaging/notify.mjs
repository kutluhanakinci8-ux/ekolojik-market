import { getEkolojikOpsEmail } from '../ekolojikMailConfig.mjs';
import { sendEkolojikMail } from '../emailOutboxProcessor.mjs';

export function isMessagingCustomerEmailEnabled() {
  return process.env.EKOLOJIK_MESSAGING_CUSTOMER_EMAIL === '1';
}

export async function notifyOnMessagingMessage(dataDir, { thread, message }) {
  const summary = { ops: null, customer: null, opsSkipped: false, customerSkipped: false };

  if (message.direction === 'customer') {
    const opsEmail = getEkolojikOpsEmail();
    if (opsEmail?.includes('@')) {
      summary.ops = await sendEkolojikMail(dataDir, {
        to: opsEmail,
        subject: `[Mesaj] ${thread.customerName} — ${thread.subject}`,
        body: [
          'Yeni müşteri yönünde mesaj (Ekolojik mesajlaşma Faz 3)',
          '',
          `Thread: ${thread.id}`,
          `Müşteri: ${thread.customerName} (${thread.customerId})`,
          `Konu: ${thread.subject}`,
          '',
          message.bodyText,
          '',
          '— POS / Ekolojik messaging',
        ].join('\n'),
        idempotencyKey: `messaging:ops:${message.id}`,
        source: 'messaging-ops',
      });
    } else {
      summary.opsSkipped = true;
    }
  }

  if (message.direction === 'staff' && isMessagingCustomerEmailEnabled()) {
    const to = thread.customerEmail?.trim();
    if (to?.includes('@')) {
      summary.customer = await sendEkolojikMail(dataDir, {
        to,
        subject: `Ekolojik Market — ${thread.subject}`,
        body: [
          `Sayın ${thread.customerName},`,
          '',
          'Size yeni bir mesaj iletildi:',
          '',
          message.bodyText,
          '',
          'Bu e-posta bilgilendirme amaçlıdır; yanıtlamak için mağazamızla iletişime geçebilirsiniz.',
        ].join('\n'),
        idempotencyKey: `messaging:customer:${message.id}`,
        source: 'messaging-customer',
      });
    } else {
      summary.customerSkipped = true;
    }
  }

  summary.ok = true;
  return summary;
}
