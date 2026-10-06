/** Basit RFC822 gövde çıkarımı (Posta hub okuma paneli) */

function decodeQuotedPrintable(input) {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtml(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseHeaders(raw) {
  const split = raw.match(/\r?\n\r?\n/);
  const headerBlock = split ? raw.slice(0, split.index) : raw.slice(0, 4000);
  const headers = {};
  for (const line of headerBlock.split(/\r?\n/)) {
    const m = line.match(/^([\w-]+):\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    headers[key] = headers[key] ? `${headers[key]}\n${m[2]}` : m[2];
  }
  return headers;
}

function extractPart(raw, contentType) {
  const ct = contentType.toLowerCase();
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    if (ct.includes('text/html')) return { html: decodeQuotedPrintable(raw) };
    return { text: decodeQuotedPrintable(raw) };
  }
  const boundary = boundaryMatch[1];
  const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`, 'g'));
  let text = '';
  let html = '';
  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;
    const subHeaders = parseHeaders(part);
    const subType = (subHeaders['content-type'] ?? '').toLowerCase();
    const bodyStart = part.search(/\r?\n\r?\n/);
    if (bodyStart < 0) continue;
    let body = part.slice(bodyStart).replace(/^\r?\n\r?\n/, '');
    if (subHeaders['content-transfer-encoding']?.toLowerCase().includes('quoted-printable')) {
      body = decodeQuotedPrintable(body);
    }
    if (subType.includes('text/plain') && !text) text = body.trim();
    if (subType.includes('text/html') && !html) html = body.trim();
  }
  return { text, html };
}

export function parseMailBody(rawSource) {
  const raw = String(rawSource ?? '');
  if (!raw.trim()) {
    return { text: '', html: '', snippet: '' };
  }

  const headers = parseHeaders(raw);
  const bodyStart = raw.search(/\r?\n\r?\n/);
  const bodyRaw = bodyStart >= 0 ? raw.slice(bodyStart).replace(/^\r?\n\r?\n/, '') : raw;
  const contentType = headers['content-type'] ?? 'text/plain';
  const encoding = headers['content-transfer-encoding'] ?? '';

  let text = '';
  let html = '';

  if (contentType.toLowerCase().includes('multipart')) {
    const parts = extractPart(raw, contentType);
    text = parts.text ?? '';
    html = parts.html ?? '';
  } else if (contentType.toLowerCase().includes('text/html')) {
    html = encoding.toLowerCase().includes('quoted-printable')
      ? decodeQuotedPrintable(bodyRaw)
      : bodyRaw;
  } else {
    text = encoding.toLowerCase().includes('quoted-printable')
      ? decodeQuotedPrintable(bodyRaw)
      : bodyRaw;
  }

  if (!text && html) text = stripHtml(html);
  if (!html && text && text.includes('<') && text.includes('>')) {
    html = text;
    text = stripHtml(text);
  }

  text = text.replace(/\0/g, '').trim();
  html = html.replace(/\0/g, '').trim();
  const snippet = (text || stripHtml(html)).replace(/\s+/g, ' ').slice(0, 240);

  return { text, html, snippet };
}
