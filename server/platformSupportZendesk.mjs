/** Zendesk ↔ platform destek kaydı köprüsü (webhook + isteğe bağlı API push) */

import { findCaseByExternalTicket, updatePlatformCase, appendCaseActivity, getPlatformCase } from './platformCaseStore.mjs';

export function getZendeskBridgeConfig() {
  const subdomain = process.env.EKOLOJIK_ZENDESK_SUBDOMAIN?.trim() || '';
  const webhookSecret = process.env.EKOLOJIK_ZENDESK_WEBHOOK_SECRET?.trim() || '';
  const apiEmail = process.env.EKOLOJIK_ZENDESK_API_EMAIL?.trim() || '';
  const apiToken = process.env.EKOLOJIK_ZENDESK_API_TOKEN?.trim() || '';
  return {
    subdomain,
    webhookSecret,
    apiEmail,
    apiToken,
    webhookConfigured: Boolean(webhookSecret),
    apiConfigured: Boolean(subdomain && apiEmail && apiToken),
    ticketUrlBase: subdomain ? `https://${subdomain}.zendesk.com/agent/tickets/` : null,
  };
}

export function buildZendeskTicketUrl(ticketId) {
  const id = String(ticketId ?? '').trim();
  if (!id) return null;
  const { ticketUrlBase } = getZendeskBridgeConfig();
  if (!ticketUrlBase) return null;
  return `${ticketUrlBase}${id}`;
}

export function enrichExternalTicketRef(ref) {
  if (!ref || typeof ref !== 'object') return ref;
  const id = String(ref.id ?? '').trim();
  if (!id) return null;
  const provider = String(ref.provider ?? 'zendesk').trim() || 'zendesk';
  const url = String(ref.url ?? '').trim() || buildZendeskTicketUrl(id);
  return { provider, id, url: url || null };
}

const ZENDESK_TO_CASE_STATUS = {
  new: 'new',
  open: 'open',
  pending: 'pending',
  hold: 'pending',
  solved: 'solved',
  closed: 'closed',
};

export function mapZendeskStatusToCase(status) {
  const key = String(status ?? '').trim().toLowerCase();
  return ZENDESK_TO_CASE_STATUS[key] ?? null;
}

function extractWebhookPayload(body) {
  if (!body || typeof body !== 'object') return { ticketId: '', status: null, comment: null };
  const ticket =
    body.ticket && typeof body.ticket === 'object' ? body.ticket : null;
  const detail = body.detail && typeof body.detail === 'object' ? body.detail : null;

  const ticketId = String(
    body.ticket_id
    ?? ticket?.id
    ?? detail?.id
    ?? body.id
    ?? '',
  ).trim();

  const status = body.status ?? ticket?.status ?? detail?.status ?? body.current_status ?? null;

  let comment =
    body.latest_comment
    ?? body.comment
    ?? body.description
    ?? detail?.description
    ?? null;
  if (comment && typeof comment === 'object') {
    comment = comment.body ?? comment.plain_body ?? comment.html_body ?? null;
  }

  return { ticketId, status, comment: comment != null ? String(comment) : null };
}

export function verifyZendeskWebhookSecret(req) {
  const cfg = getZendeskBridgeConfig();
  if (!cfg.webhookSecret) {
    return { ok: false, status: 503, error: 'Zendesk webhook yapılandırılmadı (EKOLOJIK_ZENDESK_WEBHOOK_SECRET)' };
  }
  const header =
    req.headers['x-zendesk-webhook-secret']
    ?? req.headers['x-webhook-secret']
    ?? '';
  const auth = String(req.headers.authorization ?? '');
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  const provided = String(header || bearer || '').trim();
  if (!provided || provided !== cfg.webhookSecret) {
    return { ok: false, status: 401, error: 'Geçersiz webhook secret' };
  }
  return { ok: true };
}

export async function processZendeskWebhook(dataDir, body) {
  const { ticketId, status, comment } = extractWebhookPayload(body);
  if (!ticketId) {
    return { ok: false, status: 400, error: 'ticket_id bulunamadı' };
  }

  const caseRow = await findCaseByExternalTicket(dataDir, 'zendesk', ticketId);
  if (!caseRow) {
    return { ok: true, matched: false, ticketId, message: 'Bağlı platform kaydı yok' };
  }

  const mapped = mapZendeskStatusToCase(status);
  if (mapped) {
    await updatePlatformCase(dataDir, caseRow.id, { status: mapped }, 'zendesk');
  }

  const statusLine = status ? `Durum: ${status}${mapped ? ` → ${mapped}` : ''}` : 'Zendesk güncelleme';
  const bodyText = [
    statusLine,
    comment ? comment.slice(0, 4000) : '',
  ]
    .filter(Boolean)
    .join('\n\n');

  if (bodyText.trim()) {
    await appendCaseActivity(
      dataDir,
      caseRow.id,
      { type: 'zendesk_webhook', body: bodyText, channel: 'zendesk' },
      'zendesk',
    );
  }

  const fresh = await getPlatformCase(dataDir, caseRow.id);
  return {
    ok: true,
    matched: true,
    ticketId,
    caseId: caseRow.id,
    caseNumber: fresh?.number ?? caseRow.number,
    status: fresh?.status ?? caseRow.status,
  };
}

function buildCaseSummaryForZendesk(caseRow) {
  const lines = [
    `Platform destek kaydı #${caseRow.number}`,
    `Durum: ${caseRow.status} · Kanal: ${caseRow.channel}`,
    `Konu: ${caseRow.subject || '—'}`,
    `Talep eden: ${caseRow.requesterEmail ?? caseRow.requesterName ?? '—'}`,
  ];
  if (caseRow.tenantId) lines.push(`Kiracı: ${caseRow.businessName ?? caseRow.tenantId}`);
  if (caseRow.notes) lines.push('', 'Notlar:', caseRow.notes.slice(0, 1500));
  return lines.join('\n');
}

async function zendeskApiJson(cfg, path, { method = 'GET', body } = {}) {
  const url = `https://${cfg.subdomain}.zendesk.com/api/v2${path}`;
  const auth = Buffer.from(`${cfg.apiEmail}/token:${cfg.apiToken}`, 'utf8').toString('base64');
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const msg = json?.error ?? json?.description ?? text?.slice(0, 200) ?? res.statusText;
    return { ok: false, status: res.status, error: String(msg) };
  }
  return { ok: true, json };
}

export async function pushPlatformCaseSummaryToZendesk(dataDir, caseId) {
  const cfg = getZendeskBridgeConfig();
  if (!cfg.apiConfigured) {
    return { ok: false, status: 503, error: 'Zendesk API yapılandırılmadı (subdomain, e-posta, token)' };
  }

  const caseRow = await getPlatformCase(dataDir, caseId);
  if (!caseRow) return { ok: false, status: 404, error: 'Kayıt bulunamadı' };

  const ref = enrichExternalTicketRef(caseRow.externalTicketRef);
  if (!ref?.id) {
    return { ok: false, status: 400, error: 'Zendesk ticket ID kayıtlı değil' };
  }

  const comment = buildCaseSummaryForZendesk(caseRow);
  const api = await zendeskApiJson(cfg, `/tickets/${ref.id}.json`, {
    method: 'PUT',
    body: {
      ticket: {
        comment: { body: comment, public: false },
      },
    },
  });

  if (!api.ok) return api;

  await appendCaseActivity(
    dataDir,
    caseId,
    {
      type: 'zendesk_push',
      body: `Platform özeti Zendesk #${ref.id} iç not olarak gönderildi.`,
      channel: 'zendesk',
    },
    'platform',
  );

  if (!caseRow.externalTicketRef?.url && ref.url) {
    await updatePlatformCase(dataDir, caseId, { externalTicketRef: ref }, 'platform');
  }

  return { ok: true, ticketId: ref.id, url: ref.url };
}
