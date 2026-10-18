/** Zendesk ↔ platform destek kaydı köprüsü (webhook + isteğe bağlı API push) */

import {
  findCaseByExternalTicket,
  findCaseByNumber,
  updatePlatformCase,
  appendCaseActivity,
  getPlatformCase,
} from './platformCaseStore.mjs';

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

const CASE_TO_ZENDESK_STATUS = {
  new: 'new',
  open: 'open',
  pending: 'pending',
  solved: 'solved',
  closed: 'closed',
};

export function mapCaseStatusToZendesk(status) {
  const key = String(status ?? '').trim().toLowerCase();
  return CASE_TO_ZENDESK_STATUS[key] ?? null;
}

export function platformCaseZendeskTag(caseNumber) {
  const n = Number(caseNumber);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `platform_case_${n}`;
}

/** Webhook’ta externalTicketRef yoksa etiket / external_id / özel alan ile kayıt bul */
export function inferCaseNumberFromZendeskWebhook(body) {
  if (!body || typeof body !== 'object') return null;
  const ticket = body.ticket && typeof body.ticket === 'object' ? body.ticket : null;
  const detail = body.detail && typeof body.detail === 'object' ? body.detail : null;
  const tags = [];
  for (const src of [ticket?.tags, detail?.tags, body.tags]) {
    if (Array.isArray(src)) tags.push(...src);
  }
  for (const t of tags) {
    const m = String(t).match(/^platform_case_(\d+)$/i);
    if (m) return Number(m[1]);
  }
  for (const ext of [ticket?.external_id, detail?.external_id, body.external_id]) {
    if (!ext) continue;
    const m = String(ext).match(/^platform-?case-?(\d+)$/i);
    if (m) return Number(m[1]);
  }
  const fieldId = process.env.EKOLOJIK_ZENDESK_CASE_NUMBER_FIELD_ID?.trim();
  const customFields = ticket?.custom_fields ?? detail?.custom_fields;
  if (fieldId && Array.isArray(customFields)) {
    const hit = customFields.find((f) => String(f.id) === fieldId);
    const val = Number(hit?.value);
    if (Number.isFinite(val) && val > 0) return val;
  }
  const comment = extractWebhookPayload(body).comment ?? '';
  const m2 = comment.match(/(?:destek|platform)\s*#?\s*(\d{1,8})/i);
  if (m2) return Number(m2[1]);
  return null;
}

async function resolveCaseForZendeskWebhook(dataDir, ticketId, body) {
  const linked = await findCaseByExternalTicket(dataDir, 'zendesk', ticketId);
  if (linked) return { caseRow: linked, linked: true };

  const caseNumber = inferCaseNumberFromZendeskWebhook(body);
  if (!caseNumber) return { caseRow: null, linked: false };

  const byNumber = await findCaseByNumber(dataDir, caseNumber);
  if (!byNumber) return { caseRow: null, linked: false };

  const existingRef = String(byNumber.externalTicketRef?.id ?? '').trim();
  if (existingRef && existingRef !== String(ticketId)) {
    return { caseRow: null, linked: false, conflict: true, caseNumber };
  }

  const ref = enrichExternalTicketRef({ provider: 'zendesk', id: ticketId, url: null });
  await updatePlatformCase(dataDir, byNumber.id, { externalTicketRef: ref }, 'zendesk');
  const fresh = await getPlatformCase(dataDir, byNumber.id);
  return { caseRow: fresh ?? byNumber, linked: true, autoLinked: true };
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

  const resolved = await resolveCaseForZendeskWebhook(dataDir, ticketId, body);
  const caseRow = resolved.caseRow;
  if (!caseRow) {
    return {
      ok: true,
      matched: false,
      ticketId,
      message: resolved.conflict
        ? `Kayıt #${resolved.caseNumber} başka bir Zendesk ticket’a bağlı`
        : 'Bağlı platform kaydı yok (platform_case_N etiketi veya ticket ID kaydı gerekir)',
    };
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
    autoLinked: Boolean(resolved.autoLinked),
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

export async function syncPlatformCaseStatusToZendesk(dataDir, caseId) {
  const cfg = getZendeskBridgeConfig();
  if (!cfg.apiConfigured) {
    return { ok: false, status: 503, error: 'Zendesk API yapılandırılmadı' };
  }

  const caseRow = await getPlatformCase(dataDir, caseId);
  if (!caseRow) return { ok: false, status: 404, error: 'Kayıt bulunamadı' };

  const ref = enrichExternalTicketRef(caseRow.externalTicketRef);
  if (!ref?.id) {
    return { ok: false, status: 400, error: 'Zendesk ticket ID kayıtlı değil' };
  }

  const zStatus = mapCaseStatusToZendesk(caseRow.status);
  if (!zStatus) {
    return { ok: false, status: 400, error: 'Platform durumu Zendesk ile uyumlu değil' };
  }

  const api = await zendeskApiJson(cfg, `/tickets/${ref.id}.json`, {
    method: 'PUT',
    body: { ticket: { status: zStatus } },
  });
  if (!api.ok) return api;

  await appendCaseActivity(
    dataDir,
    caseId,
    {
      type: 'zendesk_push',
      body: `Platform durumu Zendesk #${ref.id} üzerinde "${zStatus}" olarak güncellendi.`,
      channel: 'zendesk',
    },
    'platform',
  );

  return { ok: true, ticketId: ref.id, zendeskStatus: zStatus };
}

export async function createZendeskTicketFromPlatformCase(dataDir, caseId, operatorUsername) {
  const cfg = getZendeskBridgeConfig();
  if (!cfg.apiConfigured) {
    return { ok: false, status: 503, error: 'Zendesk API yapılandırılmadı (subdomain, e-posta, token)' };
  }

  const caseRow = await getPlatformCase(dataDir, caseId);
  if (!caseRow) return { ok: false, status: 404, error: 'Kayıt bulunamadı' };

  if (caseRow.externalTicketRef?.id) {
    return { ok: false, status: 409, error: 'Kayıt zaten bir Zendesk ticket’a bağlı' };
  }

  const email = String(caseRow.requesterEmail ?? '').trim();
  if (!email.includes('@')) {
    return { ok: false, status: 400, error: 'Zendesk ticket için talep eden e-posta gerekli' };
  }

  const tag = platformCaseZendeskTag(caseRow.number);
  const baseSubject = String(caseRow.subject ?? 'Destek').trim() || 'Destek';
  const subject = baseSubject.includes(`#${caseRow.number}`)
    ? baseSubject
    : `[Destek #${caseRow.number}] ${baseSubject}`;

  const zStatus = mapCaseStatusToZendesk(caseRow.status) ?? 'open';
  const api = await zendeskApiJson(cfg, '/tickets.json', {
    method: 'POST',
    body: {
      ticket: {
        subject,
        comment: { body: buildCaseSummaryForZendesk(caseRow) },
        requester: { name: String(caseRow.requesterName ?? email).trim() || email, email },
        tags: ['platform_case', 'ekolojik_platform', ...(tag ? [tag] : [])],
        external_id: `platform-case-${caseRow.number}`,
        status: zStatus,
      },
    },
  });

  if (!api.ok) return api;

  const ticketId = String(api.json?.ticket?.id ?? '').trim();
  if (!ticketId) {
    return { ok: false, status: 502, error: 'Zendesk ticket ID alınamadı' };
  }

  const ref = enrichExternalTicketRef({ provider: 'zendesk', id: ticketId, url: null });
  await updatePlatformCase(dataDir, caseId, { externalTicketRef: ref }, operatorUsername ?? 'platform');

  await appendCaseActivity(
    dataDir,
    caseId,
    {
      type: 'zendesk_push',
      body: `Zendesk ticket #${ticketId} oluşturuldu ve kayda bağlandı.`,
      channel: 'zendesk',
    },
    operatorUsername ?? 'platform',
  );

  return { ok: true, ticketId, url: ref.url };
}

/** Platform yanıtını Zendesk ticket’a yorum olarak yaz (e-posta/mesaj = public, not = internal) */
export async function pushZendeskCommentForCaseReply(dataDir, caseRow, { channel, body, operatorUsername }) {
  const cfg = getZendeskBridgeConfig();
  if (!cfg.apiConfigured) {
    return { ok: false, skipped: true, reason: 'api_not_configured' };
  }
  const ref = enrichExternalTicketRef(caseRow.externalTicketRef);
  if (!ref?.id) {
    return { ok: false, skipped: true, reason: 'no_ticket_ref' };
  }

  const ch = String(channel ?? 'note').trim().toLowerCase();
  const text = String(body ?? '').trim();
  if (!text) return { ok: false, error: 'Boş yorum' };

  const isPublic = ch === 'email' || ch === 'messaging';
  const prefix =
    ch === 'email'
      ? '[Platform e-posta yanıtı]'
      : ch === 'messaging'
        ? '[Platform mesaj yanıtı]'
        : '[Platform iç not]';
  const commentBody = `${prefix} (${operatorUsername ?? 'operatör'})\n\n${text.slice(0, 8000)}`;

  const api = await zendeskApiJson(cfg, `/tickets/${ref.id}.json`, {
    method: 'PUT',
    body: {
      ticket: {
        comment: { body: commentBody, public: isPublic },
      },
    },
  });
  if (!api.ok) return api;

  await appendCaseActivity(
    dataDir,
    caseRow.id,
    {
      type: 'zendesk_push',
      body: `Yanıt Zendesk #${ref.id} üzerine ${isPublic ? 'müşteri' : 'iç'} yorum olarak yazıldı.`,
      channel: 'zendesk',
    },
    operatorUsername ?? 'platform',
  );

  return { ok: true, ticketId: ref.id, public: isPublic };
}
