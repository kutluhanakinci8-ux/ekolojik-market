/** Hafif markdown → HTML + düz metin (Posta hub compose — Faz 8.4) */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatPostaComposeBody(markdown) {
  const src = String(markdown ?? '').trim();
  if (!src) return { text: '', html: '' };

  let html = escapeHtml(src);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n- (.+)/g, '\n<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (block) => `<ul>${block}</ul>`);
  html = html.replace(/\n/g, '<br/>');

  const text = src
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/^- /gm, '• ');

  return { text, html: `<div>${html}</div>` };
}
