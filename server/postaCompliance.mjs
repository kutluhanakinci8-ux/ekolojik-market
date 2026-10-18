/** Kurumsal uyumluluk — legal hold, arşiv dışa aktarma, DLP (lite) */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listUnifiedPostaInbox, listUnifiedPostaSent } from './postaInbox.mjs';

const HOLD_PATH = (dataDir, tenantId) => join(dataDir, 'posta-compliance', tenantId, 'legal-hold.json');

function dlpPatterns() {
  const raw = process.env.EKOLOJIK_POSTA_DLP_PATTERNS?.trim() || '';
  if (!raw) {
    return [
      /\b\d{16}\b/,
      /\bTR\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{2}\b/i,
    ];
  }
  return raw.split('|').map((p) => {
    try {
      return new RegExp(p.trim(), 'i');
    } catch {
      return null;
    }
  }).filter(Boolean);
}

export async function readLegalHoldIds(dataDir, tenantId) {
  try {
    const raw = JSON.parse(await readFile(HOLD_PATH(dataDir, tenantId), 'utf8'));
    return new Set(Array.isArray(raw.messageIds) ? raw.messageIds.map(String) : []);
  } catch {
    return new Set();
  }
}

export async function setLegalHold(dataDir, tenantId, { messageIds, hold }) {
  const ids = new Set(await readLegalHoldIds(dataDir, tenantId));
  for (const id of messageIds ?? []) {
    const mid = String(id).trim();
    if (!mid) continue;
    if (hold) ids.add(mid);
    else ids.delete(mid);
  }
  await mkdir(join(dataDir, 'posta-compliance', tenantId), { recursive: true });
  await writeFile(
    HOLD_PATH(dataDir, tenantId),
    JSON.stringify({ messageIds: [...ids], updatedAt: new Date().toISOString() }, null, 2),
    'utf8',
  );
  return { ok: true, count: ids.size };
}

export function scanOutboundDlp({ subject = '', body = '', html = '' }) {
  const text = `${subject}\n${body}\n${html}`;
  const hits = [];
  for (const re of dlpPatterns()) {
    if (re.test(text)) hits.push(re.source);
  }
  if (process.env.EKOLOJIK_POSTA_DLP_BLOCK === '1' && hits.length) {
    return { ok: false, blocked: true, hits, error: 'DLP: hassas veri deseni tespit edildi' };
  }
  return { ok: true, blocked: false, hits };
}

export async function buildComplianceArchiveExport(dataDir, tenantId, { limit = 500 } = {}) {
  const max = Math.min(2000, Math.max(1, Number(limit) || 500));
  const folders = ['gelen', 'gonderilen', 'fatura', 'spam', 'cop', 'arsiv'];
  const messages = [];
  for (const folder of folders) {
    if (folder === 'gonderilen') {
      const sent = await listUnifiedPostaSent(dataDir, tenantId, { limit: Math.floor(max / folders.length) });
      messages.push(...(sent.items ?? []).map((m) => ({ ...m, folder })));
    } else {
      const inbox = await listUnifiedPostaInbox(dataDir, tenantId, {
        folder,
        limit: Math.floor(max / folders.length),
      });
      messages.push(...(inbox.items ?? []).map((m) => ({ ...m, folder })));
    }
  }
  const hold = await readLegalHoldIds(dataDir, tenantId);
  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    tenantId,
    eDiscoveryLite: true,
    legalHoldCount: hold.size,
    messageCount: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      folder: m.folder,
      subject: m.subject,
      from: m.from,
      at: m.at,
      legalHold: hold.has(m.id),
      preview: String(m.preview ?? m.bodyText ?? '').slice(0, 500),
    })),
  };
}
