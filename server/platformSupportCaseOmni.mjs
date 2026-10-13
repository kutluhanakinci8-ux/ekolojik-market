/** Destek D4 — case üzerinden e-posta, mesajlaşma ve iç not */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appendMessagingMessage, listMessagingMessages } from './messaging/store.mjs';
import { getPlatformCase, appendCaseActivity } from './platformCaseStore.mjs';
import { replyPlatformSupportInbox } from './platformSupportInbox.mjs';
import { getPlatformSupportMailPresentation } from './platformSupportMailConfig.mjs';
import { sendViaEkolojikSmtp } from './ekolojikSmtp.mjs';
import { buildPlatformSupportOperatorReplyContent } from './platformSupportAutoreplyTemplate.mjs';

const MACROS_PATH = (dataDir) => join(dataDir, 'platform', 'support-macros.json');

const DEFAULT_MACROS = [
  { id: 'first_reply', label: 'İlk yanıt', body: 'Merhaba,\n\nTalebiniz için teşekkürler. İnceliyoruz; en kısa sürede bilgi vereceğiz.\n\nSaygılarımızla,' },
  { id: 'sla_sorry', label: 'SLA özür', body: 'Merhaba,\n\nYanıtımızın geciktiği için özür dileriz. Konuyu önceliklendirdik.\n\nSaygılarımızla,' },
  { id: 'resolved', label: 'Çözüldü', body: 'Merhaba,\n\nKaydınızı çözüldü olarak işaretledik. Başka bir sorunuz olursa yazabilirsiniz.\n\nSaygılarımızla,' },
];

export async function listPlatformSupportMacros(dataDir) {
  try {
    const parsed = JSON.parse(await readFile(MACROS_PATH(dataDir), 'utf8'));
    const macros = Array.isArray(parsed) ? parsed : parsed.macros;
    if (Array.isArray(macros) && macros.length) return macros;
  } catch {
    /* varsayılan */
  }
  return DEFAULT_MACROS;
}

export async function getPlatformSupportCaseDetail(dataDir, caseId) {
  const caseRow = await getPlatformCase(dataDir, caseId);
  if (!caseRow) return { ok: false, error: 'Kayıt bulunamadı' };

  let messagingPreview = null;
  const tenantId = caseRow.links?.tenantId ?? caseRow.tenantId;
  const threadId = caseRow.links?.threadId;
  if (tenantId && threadId) {
    const thread = await listMessagingMessages(dataDir, tenantId, threadId, { limit: 8 });
    if (thread.ok) {
      messagingPreview = {
        thread: thread.thread,
        messages: thread.messages ?? [],
      };
    }
  }

  let inboxSnippet = null;
  if (caseRow.links?.inboxMessageId) {
    const { getPlatformSupportInboxMessage } = await import('./platformSupportInbox.mjs');
    const msg = await getPlatformSupportInboxMessage(dataDir, caseRow.links.inboxMessageId);
    if (msg) {
      inboxSnippet = {
        id: msg.id,
        subject: msg.subject,
        from: msg.from,
        snippet: msg.snippet || msg.bodyText?.slice(0, 400),
        receivedAt: msg.receivedAt,
      };
    }
  }

  return {
    ok: true,
    case: caseRow,
    messagingPreview,
    inboxSnippet,
    macros: await listPlatformSupportMacros(dataDir),
  };
}

async function sendCaseEmail(dataDir, caseRow, text, operatorUsername) {
  if (caseRow.links?.inboxMessageId) {
    return replyPlatformSupportInbox(dataDir, {
      messageId: caseRow.links.inboxMessageId,
      body: text,
      operatorUsername,
    });
  }
  const to = caseRow.requesterEmail?.trim();
  if (!to?.includes('@')) {
    return { ok: false, error: 'E-posta yanıtı için alıcı veya gelen kutusu bağlantısı gerekli' };
  }
  const presentation = getPlatformSupportMailPresentation();
  const subject = caseRow.subject?.toLowerCase().startsWith('re:')
    ? caseRow.subject
    : `Re: ${caseRow.subject || 'Destek'}`;
  const { text: replyText, html: replyHtml } = buildPlatformSupportOperatorReplyContent({
    body: text,
    operatorUsername,
  });
  const result = await sendViaEkolojikSmtp({
    dataDir,
    to,
    subject,
    text: replyText,
    html: replyHtml,
    fromEmail: presentation.from,
    fromName: presentation.fromName,
    replyTo: presentation.replyTo,
  });
  if (!result?.messageId) {
    return { ok: false, error: result?.error ?? 'SMTP gönderimi başarısız' };
  }
  return { ok: true, to, result };
}

export async function performPlatformCaseAction(dataDir, caseId, { channel, body }, operatorUsername) {
  const caseRow = await getPlatformCase(dataDir, caseId);
  if (!caseRow) return { ok: false, error: 'Kayıt bulunamadı' };

  const text = String(body ?? '').trim();
  if (!text) return { ok: false, error: 'Metin gerekli' };

  const ch = String(channel ?? 'note').trim().toLowerCase();

  if (ch === 'note') {
    return appendCaseActivity(dataDir, caseId, { type: 'note', body: text, channel: 'internal' }, operatorUsername);
  }

  if (ch === 'email') {
    const sent = await sendCaseEmail(dataDir, caseRow, text, operatorUsername);
    if (!sent.ok) return sent;
    const logged = await appendCaseActivity(
      dataDir,
      caseId,
      { type: 'email_out', body: text, channel: 'email' },
      operatorUsername,
    );
    return { ...logged, delivery: sent };
  }

  if (ch === 'messaging') {
    const tenantId = caseRow.links?.tenantId ?? caseRow.tenantId;
    const threadId = caseRow.links?.threadId;
    if (!tenantId || !threadId) {
      return { ok: false, error: 'Mesajlaşma yanıtı için thread bağlantısı gerekli (kuyruktan talep oluşturun)' };
    }
    const msg = await appendMessagingMessage(dataDir, tenantId, threadId, {
      direction: 'staff',
      messageKind: 'human',
      authorName: operatorUsername || 'Platform',
      bodyText: text,
    });
    if (!msg.ok) return msg;
    const logged = await appendCaseActivity(
      dataDir,
      caseId,
      { type: 'messaging_out', body: text, channel: 'conversation' },
      operatorUsername,
    );
    return { ...logged, message: msg.message };
  }

  return { ok: false, error: 'Geçersiz kanal (note, email, messaging)' };
}
