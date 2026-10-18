/** Yanıtla / tümünü yanıtla / ilet — compose yardımcıları (Faz 16) */

export const POSTA_COMPOSE_MAX_ATTACH_BYTES = 10 * 1024 * 1024;

export function extractEmailAddress(raw) {
  const m = String(raw ?? '').match(/[\w.+-]+@[\w.-]+\.\w+/i);
  return m ? m[0].toLowerCase() : '';
}

export function parseRecipientList(raw) {
  const src = String(raw ?? '');
  if (!src.trim()) return [];
  const found = src.match(/[\w.+-]+@[\w.-]+\.\w+/gi) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase()))];
}

export function normalizeOurAddresses(ourEmail) {
  const list = parseRecipientList(ourEmail);
  return new Set(list);
}

export function buildReplySubject(subject) {
  const s = String(subject ?? '').trim();
  if (/^re:/i.test(s)) return s;
  return `Re: ${s || '(konu yok)'}`;
}

export function buildForwardSubject(subject) {
  const s = String(subject ?? '').trim();
  if (/^(fwd|fw|ilet):/i.test(s)) return s;
  return `Fwd: ${s || '(konu yok)'}`;
}

/**
 * @param {object} row — inbox item
 * @param {Set<string>} ourEmails
 * @param {PostaInboxItem[]} [threadMessages]
 */
export function buildReplyAllRecipients(row, ourEmails, threadMessages = []) {
  const participants = new Set();
  const add = (field) => {
    for (const e of parseRecipientList(field)) participants.add(e);
  };
  add(row.from);
  add(row.to);
  if (row.cc) add(row.cc);
  for (const msg of threadMessages) {
    add(msg.from);
    add(msg.to);
    if (msg.cc) add(msg.cc);
  }
  for (const mine of ourEmails) participants.delete(mine);

  const sender = extractEmailAddress(row.from) || participants.values().next().value || '';
  if (sender) participants.delete(sender);

  return {
    to: sender,
    cc: [...participants].join(', '),
  };
}

export function buildForwardBody(row) {
  const fromLine = row.fromName ? `${row.fromName} <${row.from}>` : String(row.from ?? '');
  const at = row.at ? new Date(row.at).toLocaleString('tr-TR') : '';
  const body = row.bodyText?.trim() || row.preview?.trim() || '';
  const quoted = body
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `\n\n---------- İletilen mesaj ----------\nKimden: ${fromLine}\nTarih: ${at}\nKonu: ${row.subject ?? ''}\n\n${quoted}\n`;
}

export function mergeReferences(existing, messageId) {
  const mid = String(messageId ?? '').trim();
  if (!mid) return existing?.trim() || undefined;
  const refs = String(existing ?? '').trim();
  if (!refs) return mid;
  if (refs.includes(mid)) return refs;
  return `${refs} ${mid}`;
}

export function validateOutboundAttachments(attachments) {
  if (!attachments?.length) return { ok: true, attachments: [] };
  const normalized = [];
  let total = 0;
  for (const raw of attachments) {
    const fileName = String(raw.fileName ?? raw.name ?? 'ek').slice(0, 200);
    const mimeType = String(raw.mimeType ?? raw.contentType ?? 'application/octet-stream');
    const dataBase64 = String(raw.dataBase64 ?? raw.contentBase64 ?? '').replace(/\s/g, '');
    if (!dataBase64) continue;
    const size = Math.ceil((dataBase64.length * 3) / 4);
    total += size;
    if (total > POSTA_COMPOSE_MAX_ATTACH_BYTES) {
      return { ok: false, error: 'Ekler toplam 10 MB sınırını aşıyor' };
    }
    normalized.push({ fileName, mimeType, dataBase64, size });
  }
  return { ok: true, attachments: normalized, totalBytes: total };
}
