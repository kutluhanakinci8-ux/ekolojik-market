/**
 * ESC/POS termal — Türkçe (PC857) + kesim öncesi besleme
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
  ['¢', 0x9b],
]);

/** Yazıcı CP857 desteklemezse okunaklı ASCII */
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
    .replace(/Ç/g, 'C');
}

export function encodePc857(text) {
  const bytes = [];
  for (const ch of String(text)) {
    if (CP857.has(ch)) {
      bytes.push(CP857.get(ch));
      continue;
    }
    const code = ch.codePointAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
    } else if (code <= 0xff) {
      bytes.push(code);
    } else {
      bytes.push(0x3f);
    }
  }
  return Buffer.from(bytes);
}

/**
 * @param {string} text düz metin fiş
 * @param {{ asciiOnly?: boolean, feedLines?: number }} opts
 */
export function buildEscPosReceiptBuffer(text, opts = {}) {
  const feedLines = Math.min(12, Math.max(4, opts.feedLines ?? 8));
  const asciiOnly = opts.asciiOnly === true || process.env.ESCPOS_ASCII_ONLY === '1';
  const normalized = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const payload = asciiOnly ? receiptTextToAsciiFallback(normalized) : normalized;

  const init = Buffer.from([0x1b, 0x40]);
  const parts = [init];

  if (!asciiOnly) {
    // PC857 Türkçe (Epson ESC/POS n=61)
    parts.push(Buffer.from([0x1b, 0x74, 0x3d]));
    parts.push(encodePc857(`${payload}\n`));
  } else {
    parts.push(Buffer.from(`${payload}\n`, 'latin1'));
  }

  // Alt boşluk + kesimden önce besleme (erken kesimi önler)
  parts.push(Buffer.from([0x1b, 0x64, feedLines]));
  parts.push(Buffer.from([0x1d, 0x56, 0x00]));

  return Buffer.concat(parts);
}
