/** Platform destek — case listesi ve kuyruk/gelen kutusundan oluşturma */

import { readPlatformCases, createPlatformCase, summarizeCases } from './platformCaseStore.mjs';

function extractEmail(from) {
  return String(from ?? '').match(/[\w.+-]+@[\w.-]+/)?.[0] ?? null;
}

export async function listPlatformSupportCases(dataDir, { status, kind, tag, limit = 80 } = {}) {
  let cases = await readPlatformCases(dataDir);
  if (status && status !== 'all') {
    cases = cases.filter((c) => c.status === status);
  }
  if (kind && kind !== 'all') {
    cases = cases.filter((c) => c.kind === kind);
  }
  if (tag && tag !== 'all') {
    const needle = String(tag).trim();
    cases = cases.filter((c) => (c.tags ?? []).includes(needle));
  }
  cases.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return {
    generatedAt: new Date().toISOString(),
    totals: summarizeCases(await readPlatformCases(dataDir)),
    cases: cases.slice(0, Math.min(limit, 200)),
  };
}

export async function listPlatformSupportCaseTags(dataDir) {
  const cases = await readPlatformCases(dataDir);
  const tags = new Set();
  for (const c of cases) {
    for (const t of c.tags ?? []) {
      const v = String(t).trim();
      if (v) tags.add(v);
    }
  }
  return { ok: true, tags: [...tags].sort((a, b) => a.localeCompare(b, 'tr')) };
}

export async function createCaseFromInboxMessage(dataDir, messageId, operatorUsername) {
  const { getPlatformSupportInboxMessage } = await import('./platformSupportInbox.mjs');
  const msg = await getPlatformSupportInboxMessage(dataDir, messageId);
  if (!msg) return { ok: false, error: 'Gelen kutusu mesajı bulunamadı' };

  const inboxRootId = msg.threadRootId || msg.id;

  return createPlatformCase(
    dataDir,
    {
      kind: 'request',
      channel: 'email',
      subject: msg.subject || 'E-posta destek',
      requesterEmail: extractEmail(msg.from),
      requesterName: String(msg.from ?? '').replace(/<[^>]+>/g, '').trim() || null,
      links: { inboxMessageId: inboxRootId },
      tags: ['destek-mail'],
    },
    operatorUsername,
  );
}

export async function createCaseFromMessagingQueue(dataDir, { tenantId, threadId, businessName, subject, customerName }, operatorUsername) {
  return createPlatformCase(
    dataDir,
    {
      kind: 'request',
      channel: 'conversation',
      tenantId,
      businessName,
      subject: subject || 'Mesajlaşma',
      requesterName: customerName,
      links: { tenantId, threadId },
      tags: ['messaging'],
      priority: 'high',
    },
    operatorUsername,
  );
}

function shouldSkipAutoCaseForContact(contact) {
  const email = String(contact.email ?? '').trim().toLowerCase();
  const subject = String(contact.subject ?? '').trim();
  const message = String(contact.message ?? '').trim();
  if (email === 'qa@test.local') return true;
  if (subject.startsWith('[qa') || subject === 'qa-probe') return true;
  if (message === 'pre-release probe') return true;
  return false;
}

async function tenantContextForContact(dataDir, contact) {
  const tenantId = String(contact.tenantId ?? '').trim();
  if (!tenantId) return { tenantId: null, businessName: null };
  const { readTenantStore } = await import('./tenantAuth.mjs');
  const store = await readTenantStore(dataDir, tenantId);
  const businessName =
    String(store?.settings?.businessName ?? '').trim()
    || (tenantId === 'main' ? 'Greenleaf Market' : tenantId);
  return { tenantId, businessName };
}

export async function autoCreateCaseForContactRow(dataDir, contact) {
  if (shouldSkipAutoCaseForContact(contact)) {
    return { skipped: true, reason: 'qa_or_internal_probe' };
  }
  const existing = await import('./platformCaseStore.mjs').then((m) =>
    m.findCaseByLink(dataDir, { contactMessageId: contact.id }),
  );
  if (existing) return { skipped: true, case: existing };
  const tenantCtx = await tenantContextForContact(dataDir, contact);
  const formBody = String(contact.message ?? '').trim();
  return createPlatformCase(
    dataDir,
    {
      kind: 'request',
      channel: 'contact_form',
      status: 'new',
      subject: contact.subject || 'İletişim formu',
      requesterName: contact.name,
      requesterEmail: contact.email,
      tenantId: tenantCtx.tenantId,
      businessName: tenantCtx.businessName,
      links: { contactMessageId: contact.id, tenantId: tenantCtx.tenantId },
      tags: ['contact-form', 'auto'],
      notes: formBody ? `Form mesajı:\n${formBody}` : '',
    },
    'system',
  );
}

export async function createCaseFromContactMessage(dataDir, contactId, operatorUsername) {
  const { listContactMessages } = await import('./tenantAuth.mjs');
  const items = await listContactMessages(dataDir, 200);
  const contact = items.find((c) => c.id === contactId);
  if (!contact) return { ok: false, error: 'İletişim kaydı bulunamadı' };

  return createPlatformCase(
    dataDir,
    {
      kind: 'request',
      channel: 'contact_form',
      subject: contact.subject || 'İletişim formu',
      requesterName: contact.name,
      requesterEmail: contact.email,
      links: { contactMessageId: contact.id },
      tags: ['contact-form'],
      notes: contact.message ? `Form mesajı:\n${contact.message}` : '',
    },
    operatorUsername,
  );
}

export async function listPlatformSupportContactQueue(dataDir, { limit = 40 } = {}) {
  const { listContactMessages } = await import('./tenantAuth.mjs');
  const { findCaseByLink } = await import('./platformCaseStore.mjs');
  const items = await listContactMessages(dataDir, limit);
  const rows = [];
  for (const c of items) {
    const linked = await findCaseByLink(dataDir, { contactMessageId: c.id });
    rows.push({
      id: c.id,
      name: c.name,
      email: c.email,
      subject: c.subject,
      messagePreview: String(c.message ?? '').slice(0, 160),
      message: String(c.message ?? ''),
      createdAt: c.createdAt,
      hasCase: Boolean(linked),
      caseId: linked?.id ?? null,
      caseNumber: linked?.number ?? null,
    });
  }
  return {
    generatedAt: new Date().toISOString(),
    total: rows.length,
    withoutCase: rows.filter((r) => !r.hasCase).length,
    items: rows,
  };
}

export function buildPlatformContactQueueCsv(payload) {
  const lines = ['id,createdAt,name,email,subject,hasCase,caseNumber,messagePreview'];
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  for (const c of payload.items ?? []) {
    lines.push(
      [
        c.id,
        c.createdAt,
        esc(c.name),
        c.email,
        esc(c.subject),
        c.hasCase ? 'yes' : 'no',
        c.caseNumber ?? '',
        esc(c.messagePreview),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}

async function attachInboundToLinkedCase(dataDir, row, linkedCase, extra = {}) {
  const { attachInboundEmailToCase } = await import('./platformSupportInboundCase.mjs');
  const result = await attachInboundEmailToCase(dataDir, linkedCase, row);
  if (result.spawnNewCase) {
    const from = result.fromCase;
    row.threadRootId = null;
    const created = await createPlatformCase(
      dataDir,
      {
        kind: 'request',
        channel: 'email',
        status: 'new',
        subject: row.subject || `Yeniden açılan: ${from.subject || 'Destek'}`,
        requesterEmail: extractEmail(row.from) || from.requesterEmail,
        requesterName: String(row.from ?? '').replace(/<[^>]+>/g, '').trim() || from.requesterName,
        links: { inboxMessageId: row.id },
        tags: ['destek-mail', 'auto', `reopen-from-${from.number}`],
        notes: `Kapalı kayıt #${from.number} sonrası yeni gelen mail.`,
      },
      'system',
    );
    const newCase = created.case ?? created;
    const { appendCaseActivity } = await import('./platformCaseStore.mjs');
    const { inboundBodyFromInboxRow } = await import('./platformSupportActivityContent.mjs');
    await appendCaseActivity(
      dataDir,
      from.id,
      {
        type: 'case_spawned',
        body: `Gelen e-posta yeni kayıt #${newCase.number} olarak açıldı (kapalı kayıt politikası).`,
        channel: 'email',
      },
      'system',
    );
    await appendCaseActivity(
      dataDir,
      newCase.id,
      {
        type: 'email_inbound',
        body: inboundBodyFromInboxRow(row),
        channel: 'email',
      },
      'system',
    );
    const { notifyCustomerSpawnedCase } = await import('./platformSupportSpawnCaseNotify.mjs');
    const notify = await notifyCustomerSpawnedCase(dataDir, {
      closedCase: from,
      newCase,
      inboxRow: row,
    });
    if (notify?.messageId) {
      const { recordCaseEmailOutbound } = await import('./platformCaseStore.mjs');
      const { buildSpawnCaseNotificationBodies } = await import('./platformSupportSpawnCaseNotify.mjs');
      const bodies = buildSpawnCaseNotificationBodies({
        closedNumber: from.number,
        newNumber: newCase.number,
        newInboxId: row.id,
        subject: row.subject,
      });
      await recordCaseEmailOutbound(dataDir, newCase.id, {
        messageId: notify.messageId,
        kind: 'spawn_notify',
        inboxMessageId: row.id,
        textPreview: bodies.text,
        htmlPreview: bodies.html,
      });
    }
    const { notifyOpsSpawnedSupportCase } = await import('./platformSupportOpsNotify.mjs');
    await notifyOpsSpawnedSupportCase(dataDir, {
      closedCase: from,
      newCase,
      inboxRow: row,
    });
    row.autoreplySentAt = new Date().toISOString();
    return { ok: true, spawned: true, case: newCase, ...extra };
  }
  return { ok: true, threaded: true, case: result.case, ...extra };
}

export async function processInboxRowForCase(dataDir, row) {
  const { findCaseByLink, findCaseByNumber } = await import('./platformCaseStore.mjs');
  const { resolveInboundCaseNumber } = await import('./platformSupportEmailCaseRef.mjs');

  const hintedNumber = resolveInboundCaseNumber({
    to: row.to,
    deliveredTo: row.deliveredTo,
    subject: row.subject,
  });
  if (hintedNumber) {
    const byNumber = await findCaseByNumber(dataDir, hintedNumber);
    if (byNumber?.links?.inboxMessageId) {
      row.threadRootId = byNumber.links.inboxMessageId;
      row.linkedCaseNumber = hintedNumber;
      return attachInboundToLinkedCase(dataDir, row, byNumber, { viaCaseNumber: true });
    }
  }

  const rootId =
    row.threadRootId && row.threadRootId !== row.id ? row.threadRootId : row.id;
  const isReply = rootId !== row.id;

  if (isReply) {
    const linked = await findCaseByLink(dataDir, { inboxMessageId: rootId });
    if (linked) {
      return attachInboundToLinkedCase(dataDir, row, linked);
    }
  }

  return autoCreateCaseForInboxRow(dataDir, row);
}

export async function autoCreateCaseForInboxRow(dataDir, row) {
  const rootId = row.threadRootId || row.id;
  const existing = await import('./platformCaseStore.mjs').then((m) =>
    m.findCaseByLink(dataDir, { inboxMessageId: rootId }),
  );
  if (existing) return { skipped: true, case: existing };
  return createPlatformCase(
    dataDir,
    {
      kind: 'request',
      channel: 'email',
      status: 'new',
      subject: row.subject || 'E-posta destek',
      requesterEmail: extractEmail(row.from),
      requesterName: String(row.from ?? '').replace(/<[^>]+>/g, '').trim() || null,
      links: { inboxMessageId: rootId },
      tags: ['destek-mail', 'auto'],
    },
    'system',
  );
}

export function buildPlatformCasesCsv(payload) {
  const lines = [
    'number,id,kind,status,priority,tenantId,subject,requesterEmail,assignee,slaDueAt,externalId,tags',
  ];
  for (const c of payload.cases ?? []) {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    lines.push(
      [
        c.number,
        c.id,
        c.kind,
        c.status,
        c.priority,
        c.tenantId ?? '',
        esc(c.subject),
        c.requesterEmail ?? '',
        c.assignee ?? '',
        c.slaDueAt ?? '',
        c.externalTicketRef?.id ?? '',
        esc((c.tags ?? []).join('; ')),
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
