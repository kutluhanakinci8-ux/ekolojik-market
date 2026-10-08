import { sendEkolojikMail } from './emailOutboxProcessor.mjs';

/** CRM e-posta — yalnızca Ekolojik Faz 1 outbox + SMTP */
export async function sendCrmEmail(dataDir, { to, subject, body, fromName, idempotencyKey, tenantId = 'main' }) {
  return sendEkolojikMail(dataDir, {
    to,
    subject,
    body,
    fromName,
    idempotencyKey,
    source: 'crm',
    tenantId,
  });
}
