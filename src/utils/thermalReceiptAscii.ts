/** Termal ESC/POS — Türkçe ve Unicode → 7-bit ASCII (POS-80C / Mac raw) */
export function toThermalReceiptAscii(text: string): string {
  return String(text)
    .replace(/\u2026/g, '...')
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
