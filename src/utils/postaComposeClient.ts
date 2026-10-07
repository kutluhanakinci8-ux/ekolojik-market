/** İstemci — yanıtla / ilet (server/postaComposeActions.mjs ile uyumlu) */

export const POSTA_COMPOSE_MAX_ATTACH_BYTES = 10 * 1024 * 1024;

export function extractEmailAddress(raw: string | undefined | null) {
  const m = String(raw ?? '').match(/[\w.+-]+@[\w.-]+\.\w+/i);
  return m ? m[0].toLowerCase() : '';
}

export function parseRecipientList(raw: string | undefined | null) {
  const src = String(raw ?? '');
  if (!src.trim()) return [];
  const found = src.match(/[\w.+-]+@[\w.-]+\.\w+/gi) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase()))];
}

export function buildReplySubject(subject: string) {
  const s = subject.trim();
  if (/^re:/i.test(s)) return s;
  return `Re: ${s || '(konu yok)'}`;
}

export function buildForwardSubject(subject: string) {
  const s = subject.trim();
  if (/^(fwd|fw|ilet):/i.test(s)) return s;
  return `Fwd: ${s || '(konu yok)'}`;
}

export type ComposeParticipantRow = {
  from?: string;
  fromName?: string;
  to?: string | null;
  cc?: string | null;
  subject?: string;
  bodyText?: string;
  preview?: string;
  at?: string;
  messageId?: string | null;
};

export function buildReplyAllRecipients(
  row: ComposeParticipantRow,
  ourEmails: Set<string>,
  threadMessages: ComposeParticipantRow[] = [],
) {
  const participants = new Set<string>();
  const add = (field?: string | null) => {
    for (const e of parseRecipientList(field)) participants.add(e);
  };
  add(row.from);
  add(row.to);
  add(row.cc);
  for (const msg of threadMessages) {
    add(msg.from);
    add(msg.to);
    add(msg.cc);
  }
  for (const mine of ourEmails) participants.delete(mine);

  const sender = extractEmailAddress(row.from) || participants.values().next().value || '';
  if (sender) participants.delete(sender);

  return { to: sender, cc: [...participants].join(', ') };
}

export function buildForwardBody(row: ComposeParticipantRow) {
  const fromLine = row.fromName ? `${row.fromName} <${row.from}>` : String(row.from ?? '');
  const at = row.at ? new Date(row.at).toLocaleString('tr-TR') : '';
  const body = row.bodyText?.trim() || row.preview?.trim() || '';
  const quoted = body
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');
  return `\n\n---------- İletilen mesaj ----------\nKimden: ${fromLine}\nTarih: ${at}\nKonu: ${row.subject ?? ''}\n\n${quoted}\n`;
}

export function mergeReferences(existing: string | undefined | null, messageId: string | undefined | null) {
  const mid = String(messageId ?? '').trim();
  if (!mid) return existing?.trim() || undefined;
  const refs = String(existing ?? '').trim();
  if (!refs) return mid;
  if (refs.includes(mid)) return refs;
  return `${refs} ${mid}`;
}

export function formatPostaComposePreview(markdown: string) {
  const src = String(markdown ?? '').trim();
  if (!src) return '';

  const escapeHtml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  let html = escapeHtml(src);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n- (.+)/g, '\n<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (block) => `<ul>${block}</ul>`);
  html = html.replace(/\n/g, '<br/>');
  return `<div>${html}</div>`;
}

export type OutboundAttachment = {
  fileName: string;
  mimeType: string;
  dataBase64: string;
};

export function totalAttachmentBytes(files: OutboundAttachment[]) {
  return files.reduce((sum, f) => sum + Math.ceil((f.dataBase64.length * 3) / 4), 0);
}
