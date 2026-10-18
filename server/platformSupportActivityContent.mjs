/** Case aktivite ve e-posta gövdesi boyut sınırları */

export const MAX_EMAIL_ACTIVITY_TEXT = 80_000;
export const MAX_EMAIL_ACTIVITY_HTML = 120_000;

export function clipEmailActivityText(value) {
  const text = String(value ?? '').trim();
  if (!text) return '';
  if (text.length <= MAX_EMAIL_ACTIVITY_TEXT) return text;
  return `${text.slice(0, MAX_EMAIL_ACTIVITY_TEXT)}\n\n[… ${text.length - MAX_EMAIL_ACTIVITY_TEXT} karakter kısaltıldı …]`;
}

export function clipEmailActivityHtml(value) {
  const html = String(value ?? '').trim();
  if (!html) return '';
  if (html.length <= MAX_EMAIL_ACTIVITY_HTML) return html;
  return `${html.slice(0, MAX_EMAIL_ACTIVITY_HTML)}\n<!-- kısaltıldı -->`;
}

export function inboundBodyFromInboxRow(row) {
  return clipEmailActivityText(row?.bodyText ?? row?.snippet ?? '');
}
