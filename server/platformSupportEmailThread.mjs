/** destek@ e-posta thread — RFC Message-ID / References eşleştirme */

export function normalizeMessageId(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const unwrapped = raw.replace(/^<|>$/g, '').trim().toLowerCase();
  return unwrapped;
}

export function parseReferencesHeader(references) {
  const text = String(references ?? '').trim();
  if (!text) return [];
  const matches = text.match(/<[^>]+>/g);
  if (matches?.length) {
    return matches.map((m) => normalizeMessageId(m)).filter(Boolean);
  }
  return text
    .split(/\s+/)
    .map((part) => normalizeMessageId(part))
    .filter(Boolean);
}

export function threadCandidateIds({ inReplyTo, references } = {}) {
  const ids = [];
  const irt = normalizeMessageId(inReplyTo);
  if (irt) ids.push(irt);
  for (const ref of parseReferencesHeader(references)) {
    if (!ids.includes(ref)) ids.push(ref);
  }
  return ids;
}

function rowMessageIdKeys(row) {
  const keys = [];
  const mid = normalizeMessageId(row.messageId);
  if (mid) keys.push(mid);
  const outbound = Array.isArray(row.outboundMessageIds) ? row.outboundMessageIds : [];
  for (const o of outbound) {
    const n = normalizeMessageId(o);
    if (n && !keys.includes(n)) keys.push(n);
  }
  return keys;
}

export function buildInboxMessageIdIndex(rows) {
  const index = new Map();
  for (const row of rows ?? []) {
    for (const key of rowMessageIdKeys(row)) {
      if (!index.has(key)) index.set(key, row);
    }
  }
  return index;
}

/**
 * Gelen mail başlıklarından kök gelen kutusu satırını bulur.
 * @returns {{ root: object, matchedId: string } | null}
 */
export function buildCaseOutboundToInboxRootIndex(cases) {
  const map = new Map();
  for (const c of cases ?? []) {
    const root = c.links?.inboxMessageId;
    if (!root) continue;
    const outbound = c.links?.emailThread?.outboundIds ?? [];
    for (const raw of outbound) {
      const n = normalizeMessageId(raw);
      if (n) map.set(n, root);
    }
  }
  return map;
}

export function resolveInboxThreadRoot(
  existingRows,
  { inReplyTo, references } = {},
  caseOutboundIndex = null,
) {
  const index = buildInboxMessageIdIndex(existingRows);
  const candidates = threadCandidateIds({ inReplyTo, references });
  for (const id of candidates) {
    const hit = index.get(id);
    if (hit) {
      const rootId = hit.threadRootId || hit.id;
      const root = existingRows.find((r) => r.id === rootId) ?? hit;
      return { root, matchedId: id };
    }
    const caseRootId = caseOutboundIndex?.get(id);
    if (caseRootId) {
      const root = existingRows.find((r) => r.id === caseRootId);
      if (root) return { root, matchedId: id };
    }
  }
  return null;
}

export function threadRootIdForRow(row) {
  return row.threadRootId || row.id;
}

export function appendOutboundMessageId(row, providerMessageId) {
  const id = String(providerMessageId ?? '').trim();
  if (!id) return;
  if (!Array.isArray(row.outboundMessageIds)) row.outboundMessageIds = [];
  if (!row.outboundMessageIds.includes(id)) row.outboundMessageIds.push(id);
}

export function mergeReferencesChain(existingReferences, ...messageIds) {
  const parts = [];
  const seen = new Set();
  const push = (raw) => {
    const n = normalizeMessageId(raw);
    if (!n || seen.has(n)) return;
    seen.add(n);
    const wrapped = raw.includes('<') ? raw.trim() : `<${raw.replace(/^<|>$/g, '').trim()}>`;
    parts.push(wrapped);
  };
  for (const ref of parseReferencesHeader(existingReferences)) {
    push(ref);
  }
  for (const mid of messageIds) {
    if (mid) push(mid);
  }
  return parts.join(' ');
}
