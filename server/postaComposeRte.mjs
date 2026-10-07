/** NB PM-2 — compose RTE yetenekleri ve HTML sanitizasyonu */

export const POSTA_COMPOSE_RTE_TOOLBAR = [
  'bold',
  'italic',
  'underline',
  'strikeThrough',
  'insertUnorderedList',
  'insertOrderedList',
  'formatBlock',
  'createLink',
  'removeFormat',
];

export function getPostaComposeRteCapabilities() {
  return {
    ok: true,
    formats: ['markdown', 'html'],
    toolbar: POSTA_COMPOSE_RTE_TOOLBAR,
    maxAttachmentBytes: 10 * 1024 * 1024,
  };
}

/** Gönderim öncesi basit XSS sertleştirme */
export function sanitizePostaComposeHtml(raw) {
  let html = String(raw ?? '').trim();
  if (!html) return '';

  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<iframe[\s\S]*?>[\s\S]*?<\/iframe>/gi, '');
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript:/gi, '');
  return html;
}

export function stripHtmlToPlainText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
