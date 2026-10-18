/** Kapalı kayıt politikası new_case — müşteriye yeni kayıt bildirimi */

import { getPlatformSupportMailPresentation } from './platformSupportMailConfig.mjs';
import { sendViaEkolojikSmtp } from './ekolojikSmtp.mjs';
import { PLATFORM_TENANT_ID } from './platformOperators.mjs';
import { buildPlatformSupportSpawnCaseNoticeContent } from './platformSupportAutoreplyTemplate.mjs';

function extractEmail(fromLabel) {
  return String(fromLabel ?? '').match(/[\w.+-]+@[\w.-]+/)?.[0] ?? null;
}

export function buildSpawnCaseNotificationBodies({ closedNumber, newNumber, newInboxId, subject }) {
  return buildPlatformSupportSpawnCaseNoticeContent({
    messageId: newInboxId,
    caseNumber: newNumber,
    closedNumber,
    subject,
  });
}

export async function notifyCustomerSpawnedCase(dataDir, { closedCase, newCase, inboxRow }) {
  const to =
    newCase?.requesterEmail?.trim()
    || extractEmail(inboxRow?.from)
    || closedCase?.requesterEmail?.trim();
  if (!to?.includes('@')) return { skipped: true, reason: 'no_recipient' };

  const pres = getPlatformSupportMailPresentation();
  const baseSubject = inboxRow?.subject || newCase?.subject || 'Destek';
  const subject = baseSubject.toLowerCase().startsWith('re:')
    ? baseSubject
    : `Re: [Destek #${newCase.number}] ${baseSubject}`;

  const { text, html } = buildSpawnCaseNotificationBodies({
    closedNumber: closedCase.number,
    newNumber: newCase.number,
    newInboxId: inboxRow?.id ?? newCase.links?.inboxMessageId,
    subject: baseSubject,
  });

  const result = await sendViaEkolojikSmtp({
    dataDir,
    tenantId: PLATFORM_TENANT_ID,
    to,
    subject,
    text,
    html,
    fromEmail: pres.from,
    fromName: pres.fromName,
    replyTo: pres.replyTo,
    inReplyTo: inboxRow?.messageId ?? undefined,
    references: inboxRow?.references ?? inboxRow?.messageId ?? undefined,
  });

  return { ok: Boolean(result?.messageId), messageId: result?.messageId, to, text, html };
}
