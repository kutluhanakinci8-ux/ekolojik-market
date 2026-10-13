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
