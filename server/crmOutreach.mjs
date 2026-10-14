import { sendEkolojikMail } from './emailOutboxProcessor.mjs';
import { sendCrmSms, isCrmSmsConfigured } from './crmSms.mjs';

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

/** CRM SMS — operatör gateway */
export async function sendCrmSmsOutreach(_dataDir, { to, body, tenantId = 'main' }) {
  const result = await sendCrmSms({ to, body });
  return { ...result, tenantId };
}

export { isCrmSmsConfigured };
