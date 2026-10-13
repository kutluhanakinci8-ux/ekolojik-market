/** Platform operasyon kaydı (case) — talep/sorun, Zendesk köprüsü için externalTicketRef */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { readSupportSlaPolicy } from './platformSupportPolicy.mjs';

const CASES_PATH = (dataDir) => join(dataDir, 'platform', 'support-cases.json');

export const CASE_STATUS = ['new', 'open', 'pending', 'solved', 'closed'];
export const CASE_KIND = ['request', 'incident', 'system'];
export const CASE_CHANNEL = ['email', 'conversation', 'contact_form', 'alert', 'manual'];

function nextCaseNumber(cases) {
  const max = cases.reduce((m, c) => Math.max(m, Number(c.number) || 0), 0);
  return max + 1;
}

export async function readPlatformCases(dataDir) {
  try {
    const raw = JSON.parse(await readFile(CASES_PATH(dataDir), 'utf8'));
    return Array.isArray(raw.cases) ? raw.cases : [];
  } catch {
    return [];
  }
}

async function writePlatformCases(dataDir, cases) {
  await mkdir(join(dataDir, 'platform'), { recursive: true });
  await writeFile(
    CASES_PATH(dataDir),
    JSON.stringify({ updatedAt: new Date().toISOString(), cases }, null, 2),
    'utf8',
  );
}

function normalizeStatus(s) {
  const v = String(s ?? 'open').trim().toLowerCase();
  return CASE_STATUS.includes(v) ? v : 'open';
}

function normalizeKind(k) {
  const v = String(k ?? 'request').trim().toLowerCase();
  return CASE_KIND.includes(v) ? v : 'request';
}

function normalizeChannel(ch) {
  const v = String(ch ?? 'manual').trim().toLowerCase();
  return CASE_CHANNEL.includes(v) ? v : 'manual';
}

function normalizePriority(p) {
  const v = String(p ?? 'normal').trim().toLowerCase();
  if (v === 'low' || v === 'high' || v === 'urgent') return v;
  return 'normal';
}

async function slaDueAt(dataDir) {
  const policy = await readSupportSlaPolicy(dataDir);
  const minutes = Number(policy.firstResponseTargetMinutes) || 240;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export async function findCaseByLink(dataDir, link) {
  const cases = await readPlatformCases(dataDir);
  if (link.inboxMessageId) {
    return cases.find((c) => c.links?.inboxMessageId === link.inboxMessageId) ?? null;
  }
  if (link.tenantId && link.threadId) {
    return (
      cases.find(
        (c) => c.links?.tenantId === link.tenantId && c.links?.threadId === link.threadId && c.status !== 'closed',
      ) ?? null
    );
  }
  return null;
}

export async function createPlatformCase(dataDir, input, operatorUsername) {
  const cases = await readPlatformCases(dataDir);
  const existing = input.links ? await findCaseByLink(dataDir, input.links) : null;
  if (existing) return { ok: true, duplicate: true, case: existing };

  const now = new Date().toISOString();
  const row = {
    id: `pc-${randomUUID()}`,
    number: nextCaseNumber(cases),
    kind: normalizeKind(input.kind),
    channel: normalizeChannel(input.channel),
    status: normalizeStatus(input.status ?? 'new'),
    priority: normalizePriority(input.priority),
    tenantId: input.tenantId ? String(input.tenantId).trim() : null,
    businessName: String(input.businessName ?? '').trim() || null,
    subject: String(input.subject ?? 'Destek kaydı').trim() || 'Destek kaydı',
    requesterName: String(input.requesterName ?? '').trim() || null,
    requesterEmail: String(input.requesterEmail ?? '').trim() || null,
    assignee: input.assignee ? String(input.assignee).trim() : null,
    tags: Array.isArray(input.tags) ? input.tags.map((t) => String(t).trim()).filter(Boolean) : [],
    links: {
      inboxMessageId: input.links?.inboxMessageId ?? null,
      threadId: input.links?.threadId ?? null,
      tenantId: input.links?.tenantId ?? input.tenantId ?? null,
      contactMessageId: input.links?.contactMessageId ?? null,
      alertKind: input.links?.alertKind ?? null,
    },
    externalTicketRef: input.externalTicketRef
      ? {
          provider: String(input.externalTicketRef.provider ?? 'zendesk').trim(),
          id: String(input.externalTicketRef.id ?? '').trim(),
          url: String(input.externalTicketRef.url ?? '').trim() || null,
        }
      : null,
    slaDueAt: input.slaDueAt ?? await slaDueAt(dataDir),
    createdAt: now,
    updatedAt: now,
    createdBy: operatorUsername ?? 'system',
    notes: String(input.notes ?? '').trim() || '',
  };

  cases.unshift(row);
  await writePlatformCases(dataDir, cases);
  return { ok: true, case: row };
}

export async function updatePlatformCase(dataDir, caseId, patch, operatorUsername) {
  const cases = await readPlatformCases(dataDir);
  const idx = cases.findIndex((c) => c.id === caseId);
  if (idx < 0) return { ok: false, error: 'Kayıt bulunamadı' };

  const row = cases[idx];
  if (patch.status != null) row.status = normalizeStatus(patch.status);
  if (patch.priority != null) row.priority = normalizePriority(patch.priority);
  if (patch.kind != null) row.kind = normalizeKind(patch.kind);
  if (patch.assignee !== undefined) row.assignee = patch.assignee ? String(patch.assignee).trim() : null;
  if (patch.subject != null) row.subject = String(patch.subject).trim() || row.subject;
  if (patch.notes != null) row.notes = String(patch.notes);
  if (patch.tags != null && Array.isArray(patch.tags)) {
    row.tags = patch.tags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (patch.externalTicketRef != null) {
    if (patch.externalTicketRef === false || patch.externalTicketRef === null) {
      row.externalTicketRef = null;
    } else {
      row.externalTicketRef = {
        provider: String(patch.externalTicketRef.provider ?? 'zendesk').trim(),
        id: String(patch.externalTicketRef.id ?? '').trim(),
        url: String(patch.externalTicketRef.url ?? '').trim() || null,
      };
    }
  }
  if (patch.slaDueAt != null) row.slaDueAt = patch.slaDueAt;
  row.updatedAt = new Date().toISOString();
  row.updatedBy = operatorUsername ?? row.updatedBy;

  cases[idx] = row;
  await writePlatformCases(dataDir, cases);
  return { ok: true, case: row };
}

export function summarizeCases(cases) {
  const open = cases.filter((c) => !['solved', 'closed'].includes(c.status));
  return {
    total: cases.length,
    open: open.length,
    new: cases.filter((c) => c.status === 'new').length,
    request: cases.filter((c) => c.kind === 'request').length,
    incident: cases.filter((c) => c.kind === 'incident').length,
    overdue: open.filter((c) => c.slaDueAt && Date.parse(c.slaDueAt) < Date.now()).length,
  };
}
