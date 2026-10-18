import { sendEkolojikMail } from './emailOutboxProcessor.mjs';
import { sendCrmSms, isCrmSmsConfigured } from './crmSms.mjs';
import { sendMailViaLertaPlatform } from './lertaPlatformBridge.mjs';

/** CRM e-posta — Lerta (yapılandırılmışsa) veya Ekolojik outbox + SMTP */
export async function sendCrmEmail(dataDir, { to, subject, body, fromName, idempotencyKey, tenantId = 'main' }) {
  const lerta = await sendMailViaLertaPlatform({
    to,
    subject,
    text: body,
    idempotencyKey: idempotencyKey ?? `crm:${tenantId}:${to}:${Date.now()}`,
  });
  if (lerta.ok) return { ...lerta, tenantId, route: 'lerta' };
  if (!lerta.skipped) return lerta;

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
export async function sendCrmSmsOutreach(dataDir, { to, body, tenantId = 'main' }) {
  const result = await sendCrmSms({ to, body, dataDir, tenantId });
  return { ...result, tenantId };
}

export { isCrmSmsConfigured };
