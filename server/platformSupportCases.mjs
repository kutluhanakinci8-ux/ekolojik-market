/** Platform destek — case listesi ve kuyruk/gelen kutusundan oluşturma */

import { readPlatformCases, createPlatformCase, summarizeCases } from './platformCaseStore.mjs';

function extractEmail(from) {
  return String(from ?? '').match(/[\w.+-]+@[\w.-]+/)?.[0] ?? null;
}

export async function listPlatformSupportCases(dataDir, { status, kind, limit = 80 } = {}) {
  let cases = await readPlatformCases(dataDir);
  if (status && status !== 'all') {
    cases = cases.filter((c) => c.status === status);
  }
  if (kind && kind !== 'all') {
    cases = cases.filter((c) => c.kind === kind);
  }
  cases.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return {
    generatedAt: new Date().toISOString(),
    totals: summarizeCases(await readPlatformCases(dataDir)),
    cases: cases.slice(0, Math.min(limit, 200)),
  };
}

export async function createCaseFromInboxMessage(dataDir, messageId, operatorUsername) {
  const { getPlatformSupportInboxMessage } = await import('./platformSupportInbox.mjs');
  const msg = await getPlatformSupportInboxMessage(dataDir, messageId);
  if (!msg) return { ok: false, error: 'Gelen kutusu mesajı bulunamadı' };

  return createPlatformCase(
    dataDir,
    {
      kind: 'request',
      channel: 'email',
      subject: msg.subject || 'E-posta destek',
      requesterEmail: extractEmail(msg.from),
      requesterName: String(msg.from ?? '').replace(/<[^>]+>/g, '').trim() || null,
      links: { inboxMessageId: msg.id },
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

export async function autoCreateCaseForContactRow(dataDir, contact) {
  const existing = await import('./platformCaseStore.mjs').then((m) =>
    m.findCaseByLink(dataDir, { contactMessageId: contact.id }),
  );
  if (existing) return { skipped: true, case: existing };
  return createPlatformCase(
    dataDir,
    {
      kind: 'request',
      channel: 'contact_form',
      status: 'new',
      subject: contact.subject || 'İletişim formu',
      requesterName: contact.name,
      requesterEmail: contact.email,
      links: { contactMessageId: contact.id },
      tags: ['contact-form', 'auto'],
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

export async function autoCreateCaseForInboxRow(dataDir, row) {
  const existing = await import('./platformCaseStore.mjs').then((m) =>
    m.findCaseByLink(dataDir, { inboxMessageId: row.id }),
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
      links: { inboxMessageId: row.id },
      tags: ['destek-mail', 'auto'],
    },
    'system',
  );
}

export function buildPlatformCasesCsv(payload) {
  const lines = [
    'number,id,kind,status,priority,tenantId,subject,requesterEmail,assignee,slaDueAt,externalId',
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
      ].join(','),
    );
  }
  return `${lines.join('\n')}\n`;
}
