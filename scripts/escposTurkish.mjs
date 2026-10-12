/**
 * ESC/POS termal — varsayılan ASCII Türkçe (POS-80C / Mac raw güvenli)
 * CP857 bazı yazıcılarda Kiril benzeri bozuk basar; ascii mod önerilir.
 */

const CP857 = new Map([
  ['Ç', 0x80],
  ['ü', 0x81],
  ['ç', 0x87],
  ['ı', 0x8d],
  ['İ', 0x98],
  ['Ö', 0x99],
  ['Ü', 0x9a],
  ['Ş', 0x9e],
  ['ş', 0x9f],
  ['ğ', 0xa7],
  ['Ğ', 0xa6],
  ['ö', 0x94],
]);

const CP1254 = new Map([
  ['Ç', 0xc7],
  ['ç', 0xe7],
  ['Ğ', 0xd0],
  ['ğ', 0xf0],
  ['İ', 0xdd],
  ['ı', 0xfd],
  ['Ö', 0xd6],
  ['ö', 0xf6],
  ['Ş', 0xde],
  ['ş', 0xfe],
  ['Ü', 0xdc],
  ['ü', 0xfc],
]);

/** Termal fiş — Türkçe harfleri okunaklı ASCII */
export function receiptTextToAsciiFallback(text) {
  return String(text)
    .replace(/₺/g, 'TL')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'U')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'O')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C')
    .replace(/[^\x00-\x7F]/g, '?');
}

function encodeMap(text, map) {
  const bytes = [];
  for (const ch of String(text)) {
    if (map.has(ch)) {
      bytes.push(map.get(ch));
      continue;
    }
    const code = ch.codePointAt(0);
    if (code <= 0x7f) bytes.push(code);
    else if (code <= 0xff) bytes.push(code);
    else bytes.push(0x3f);
  }
  return Buffer.from(bytes);
}

function resolveCharset() {
  const raw = String(process.env.ESCPOS_CHARSET || 'ascii').toLowerCase();
  if (raw === 'cp857' || raw === '857') return 'cp857';
  if (raw === 'cp1254' || raw === '1254' || raw === 'win') return 'cp1254';
  return 'ascii';
}

/**
 * @param {string} text düz metin fiş
 */
export function buildEscPosReceiptBuffer(text, opts = {}) {
  const feedLines = Math.min(
    14,
    Math.max(6, Number(process.env.ESCPOS_FEED_LINES) || opts.feedLines || 10),
  );
  const charset = opts.charset || resolveCharset();
  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  /** CP857/UTF-8 karışımı POS-80C’de Kiril benzeri bozuk basar — her zaman ASCII gövde */
  const asciiBody = receiptTextToAsciiFallback(normalized);

  const init = Buffer.from([0x1b, 0x40]);
  const parts = [init];

  if (charset === 'ascii' || charset === 'cp857') {
    parts.push(Buffer.from(`${asciiBody}\n`, 'latin1'));
  } else if (charset === 'cp1254') {
    parts.push(Buffer.from([0x1b, 0x74, 0x2f]));
    parts.push(encodeMap(`${asciiBody}\n`, CP1254));
  } else {
    parts.push(Buffer.from(`${asciiBody}\n`, 'latin1'));
  }

  parts.push(Buffer.from([0x1b, 0x64, feedLines]));
  parts.push(Buffer.from([0x1d, 0x56, 0x00]));

  return Buffer.concat(parts);
}
