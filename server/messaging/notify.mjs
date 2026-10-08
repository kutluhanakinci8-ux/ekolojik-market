import { sendEkolojikMail } from '../emailOutboxProcessor.mjs';
import { appendCustomerTrackingNotice } from '../postaCustomerEmailCompliance.mjs';
import { getEffectiveMailPresentation, shouldSendPostaNotification } from '../postaSettings.mjs';
import { recordPostaHubAlert } from '../postaHubAlerts.mjs';
import { buildMessagingCustomerSummaryEmail } from '../mailTemplates.mjs';

export function isMessagingCustomerEmailEnabled() {
  return process.env.EKOLOJIK_MESSAGING_CUSTOMER_EMAIL === '1';
}

export async function notifyOnMessagingMessage(dataDir, { thread, message, tenantId = 'main' }) {
  const summary = { ops: null, customer: null, opsSkipped: false, customerSkipped: false };

  if (message.direction === 'customer' && !thread.muted) {
    const pres = await getEffectiveMailPresentation(dataDir, tenantId);
    const opsEmail = pres.opsEmail;
    if (opsEmail?.includes('@') && (await shouldSendPostaNotification(dataDir, 'messaging', 'opsEmail', tenantId))) {
      summary.ops = await sendEkolojikMail(dataDir, {
        to: opsEmail,
        subject: `[Mesaj] ${thread.customerName} — ${thread.subject}`,
        tenantId,
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

    if (await shouldSendPostaNotification(dataDir, 'messaging', 'inAppHub', tenantId)) {
      await recordPostaHubAlert(dataDir, {
        event: 'messaging',
        threadId: thread.id,
        messageId: message.id,
        customerName: thread.customerName,
        subject: thread.subject,
        preview: String(message.bodyText ?? '').slice(0, 240),
      });
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
      const withNotice = await appendCustomerTrackingNotice(dataDir, tenantId, {
        text: tpl.text,
        html: tpl.html,
      });
      summary.customer = await sendEkolojikMail(dataDir, {
        to,
        subject: tpl.subject,
        body: withNotice.text,
        html: withNotice.html,
        idempotencyKey: `messaging:customer:${message.id}`,
        source: 'messaging-customer',
        tenantId,
      });
    } else {
      summary.customerSkipped = true;
    }
  }

  summary.ok = true;
  return summary;
}
