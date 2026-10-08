/** Basit RFC822 gövde çıkarımı (Posta hub okuma paneli) — UTF-8 / charset destekli */

function parseCharset(contentType) {
  const m = String(contentType ?? '').match(/charset=["']?([^"'\s;]+)/i);
  if (!m) return 'utf-8';
  return m[1].trim().toLowerCase().replace(/^utf8$/, 'utf-8');
}

function decodeBuffer(buf, charset) {
  const c = parseCharset(charset);
  if (c === 'utf-8' || c === 'us-ascii' || c === 'ascii') {
    return buf.toString('utf8');
  }
  if (c === 'iso-8859-9' || c === 'windows-1254' || c === 'latin5') {
    return buf.toString('latin1');
  }
  if (c === 'iso-8859-1' || c === 'latin1' || c === 'windows-1252') {
    return buf.toString('latin1');
  }
  try {
    return buf.toString('utf8');
  } catch {
    return buf.toString('latin1');
  }
}

function quotedPrintableToBuffer(input) {
  const bytes = [];
  const str = String(input ?? '').replace(/=\r?\n/g, '');
  for (let i = 0; i < str.length; i += 1) {
    if (str[i] === '=' && i + 2 < str.length) {
      const hex = str.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(str.charCodeAt(i) & 0xff);
  }
  return Buffer.from(bytes);
}

function decodeQuotedPrintable(input, charset = 'utf-8') {
  return decodeBuffer(quotedPrintableToBuffer(input), charset);
}

function decodeTransferBody(body, encoding, charset) {
  const enc = String(encoding ?? '').toLowerCase();
  const raw = String(body ?? '');
  if (enc.includes('base64')) {
    const cleaned = raw.replace(/\s/g, '');
    try {
      return decodeBuffer(Buffer.from(cleaned, 'base64'), charset);
    } catch {
      return raw;
    }
  }
  if (enc.includes('quoted-printable')) {
    return decodeQuotedPrintable(raw, charset);
  }
  return decodeBuffer(Buffer.from(raw, 'latin1'), charset);
}

/** UTF-8 baytları Latin-1 sanılarak kaydedilmiş metin (mÃ¼ÅŸteri → müşteri) */
export function repairUtf8Mojibake(str) {
  if (!str || typeof str !== 'string') return str;
  if (!/Ã|Ä|Å|â€™|â€œ|â€/.test(str)) return str;
  try {
    const repaired = Buffer.from(str, 'latin1').toString('utf8');
    if (repaired.includes('\uFFFD')) return str;
    if (/[ğüşöçıİĞÜŞÖÇ]/.test(repaired)) return repaired;
    if (repaired.length < str.length && /[a-zA-Z0-9]/.test(repaired)) return repaired;
  } catch {
    /* ignore */
  }
  return str;
}

function normalizeMailText(str) {
  return repairUtf8Mojibake(String(str ?? '').replace(/\0/g, '').trim());
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

function decodePartBody(part, subHeaders) {
  const bodyStart = part.search(/\r?\n\r?\n/);
  if (bodyStart < 0) return '';
  const body = part.slice(bodyStart).replace(/^\r?\n\r?\n/, '');
  const charset = parseCharset(subHeaders['content-type']);
  const encoding = subHeaders['content-transfer-encoding'] ?? '';
  return decodeTransferBody(body, encoding, charset);
}

function extractPart(raw, contentType) {
  const ct = contentType.toLowerCase();
  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) {
    const headers = parseHeaders(raw);
    const charset = parseCharset(headers['content-type'] || contentType);
    const encoding = headers['content-transfer-encoding'] ?? '';
    const bodyStart = raw.search(/\r?\n\r?\n/);
    const body = bodyStart >= 0 ? raw.slice(bodyStart).replace(/^\r?\n\r?\n/, '') : raw;
    const decoded = decodeTransferBody(body, encoding, charset);
    if (ct.includes('text/html')) return { html: decoded };
    return { text: decoded };
  }
  const boundary = boundaryMatch[1];
  const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`, 'g'));
  let text = '';
  let html = '';
  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;
    const subHeaders = parseHeaders(part);
    const subType = (subHeaders['content-type'] ?? '').toLowerCase();
    const decoded = decodePartBody(part, subHeaders);
    if (subType.includes('text/plain') && !text) text = decoded.trim();
    if (subType.includes('text/html') && !html) html = decoded.trim();
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
  const charset = parseCharset(contentType);
  const encoding = headers['content-transfer-encoding'] ?? '';

  let text = '';
  let html = '';

  if (contentType.toLowerCase().includes('multipart')) {
    const parts = extractPart(raw, contentType);
    text = parts.text ?? '';
    html = parts.html ?? '';
  } else if (contentType.toLowerCase().includes('text/html')) {
    html = decodeTransferBody(bodyRaw, encoding, charset);
  } else {
    text = decodeTransferBody(bodyRaw, encoding, charset);
  }

  if (!text && html) text = stripHtml(html);
  if (!html && text && text.includes('<') && text.includes('>')) {
    html = text;
    text = stripHtml(text);
  }

  text = normalizeMailText(text);
  html = normalizeMailText(html);
  const snippet = normalizeMailText((text || stripHtml(html)).replace(/\s+/g, ' ').slice(0, 240));

  return { text, html, snippet };
}

/** Multipart ekler (Faz 7.3) — base64 içerik */
export function parseMailAttachments(rawSource) {
  const raw = String(rawSource ?? '');
  if (!raw.trim()) return [];

  const boundaryMatch = raw.match(/boundary="?([^"\r\n;]+)"?/i);
  if (!boundaryMatch) return [];

  const boundary = boundaryMatch[1];
  const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:--)?`, 'g'));
  const out = [];

  for (const part of parts) {
    if (!part.trim() || part.trim() === '--') continue;
    const headers = parseHeaders(part);
    const subType = (headers['content-type'] ?? '').toLowerCase();
    if (subType.includes('text/plain') || subType.includes('text/html')) continue;
    const disp = (headers['content-disposition'] ?? '').toLowerCase();
    const nameMatch = disp.match(/filename\*?=(?:UTF-8''|"?)([^";\r\n]+)/i)
      || subType.match(/name="?([^";\r\n]+)/i);
    const fileName = nameMatch?.[1] ? decodeURIComponent(nameMatch[1].replace(/"/g, '')) : 'ek';
    const bodyStart = part.search(/\r?\n\r?\n/);
    if (bodyStart < 0) continue;
    let body = part.slice(bodyStart).replace(/^\r?\n\r?\n/, '');
    const enc = headers['content-transfer-encoding']?.toLowerCase() ?? '';
    if (enc.includes('quoted-printable')) {
      body = decodeQuotedPrintable(body, parseCharset(subType));
    }
    const b64 = body.replace(/\r?\n/g, '').replace(/\s/g, '');
    let buf;
    try {
      buf = Buffer.from(b64, 'base64');
    } catch {
      continue;
    }
    if (buf.length < 1 || buf.length > 8 * 1024 * 1024) continue;
    out.push({
      fileName: repairUtf8Mojibake(fileName),
      mimeType: subType.split(';')[0] || 'application/octet-stream',
      dataBase64: buf.toString('base64'),
      size: buf.length,
    });
  }
  return out;
}
