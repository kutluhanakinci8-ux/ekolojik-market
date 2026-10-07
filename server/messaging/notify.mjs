import { sendEkolojikMail } from '../emailOutboxProcessor.mjs';
import { getEffectiveMailPresentation, shouldSendPostaNotification } from '../postaSettings.mjs';
import { buildMessagingCustomerSummaryEmail } from '../mailTemplates.mjs';

export function isMessagingCustomerEmailEnabled() {
  return process.env.EKOLOJIK_MESSAGING_CUSTOMER_EMAIL === '1';
}

export async function notifyOnMessagingMessage(dataDir, { thread, message }) {
  const summary = { ops: null, customer: null, opsSkipped: false, customerSkipped: false };

  if (message.direction === 'customer' && !thread.muted) {
    const pres = await getEffectiveMailPresentation(dataDir);
    const opsEmail = pres.opsEmail;
    if (opsEmail?.includes('@') && (await shouldSendPostaNotification(dataDir, 'messaging'))) {
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

  if (message.direction === 'staff' && isMessagingCustomerEmailEnabled() && !thread.muted) {
    const to = thread.customerEmail?.trim();
    if (to?.includes('@')) {
      const tpl = buildMessagingCustomerSummaryEmail({
        customerName: thread.customerName,
        subject: thread.subject,
        bodyText: message.bodyText,
        threadId: thread.id,
      });
      summary.customer = await sendEkolojikMail(dataDir, {
        to,
        subject: tpl.subject,
        body: tpl.text,
        html: tpl.html,
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
