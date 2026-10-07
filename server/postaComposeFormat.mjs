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
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/\n- (.+)/g, '\n<li>$1</li>');
  html = html.replace(/(<li>[\s\S]*?<\/li>)+/g, (block) => `<ul>${block}</ul>`);
  html = html.replace(/\n/g, '<br/>');

  const text = src
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,3} /gm, '')
    .replace(/^> /gm, '')
    .replace(/^- /gm, '• ');

  return { text, html: `<div>${html}</div>` };
}
