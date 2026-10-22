import type { Product } from '../types/product';
import type { StockCountReport } from '../types/stockCountReport';
import { stockCountReportDiscrepancies } from '../types/stockCountReport';
import {
  formatStockCountBreaksPlain,
  formatStockCountReportDateTime,
  stockCountHeaderMetaPlain,
  stockCountSignatureBlockPlain,
} from './stockCountReportFormat';
import { getLastLimaRawPrintError, tryLimaRawReceiptPrint } from './limaRawReceiptPrint';
import { printHtmlReceipt } from './receiptPrint';
import { STANDARD_WINDOWS_ZYWELL_PRINTER_NAME } from '../types/receiptPrinter';

const PLAIN_LINE_WIDTH = 48;

export interface StockCountReceiptReportData {
  businessName: string;
  report: StockCountReport;
  products: Product[];
  printedAt: Date;
}

function formatReceiptDateTime(date: Date): string {
  return formatStockCountReportDateTime(date.toISOString());
}

function plainPadLine(left: string, right: string, width = PLAIN_LINE_WIDTH): string {
  const r = right.trim();
  const maxLeft = Math.max(1, width - r.length - 1);
  const l = left.length > maxLeft ? `${left.slice(0, maxLeft - 1)}.` : left;
  const spaces = Math.max(1, width - l.length - r.length);
  return `${l}${' '.repeat(spaces)}${r}`;
}

function productLabel(product: Product | undefined, productId: number): string {
  if (!product) return `#${productId}`;
  const code = product.productCode?.trim();
  return code ? code : product.name.slice(0, 22);
}

export function buildPlainTextStockCountReceipt(
  data: StockCountReceiptReportData,
  paperWidthMm: 58 | 80 = 80,
): string {
  const lineWidth = paperWidthMm === 58 ? 32 : PLAIN_LINE_WIDTH;
  const rule = '-'.repeat(Math.min(lineWidth, PLAIN_LINE_WIDTH));
  const discrepancies = stockCountReportDiscrepancies(data.report);
  const totalScanned = data.report.lines.reduce((sum, line) => sum + line.scannedQty, 0);

  const lines: string[] = [
    data.businessName.trim(),
    'STOK SAYIM RAPORU',
    rule,
    `Rapor: ${data.report.id.slice(0, 18)}`,
    ...stockCountHeaderMetaPlain(data.report, lineWidth),
    `Yazdirma: ${formatReceiptDateTime(data.printedAt)}`,
  ];
  const breakLines = formatStockCountBreaksPlain(data.report.breaks, lineWidth);
  if (breakLines.length > 0) {
    lines.push(rule);
    lines.push(...breakLines);
  }
  lines.push(
    rule,
    plainPadLine('Kalem', String(data.report.lines.length), lineWidth),
    plainPadLine('Okutma', String(totalScanned), lineWidth),
    plainPadLine('Farkli urun', String(discrepancies.length), lineWidth),
  );

  if (data.report.note.trim()) {
    lines.push(rule);
    lines.push(`Not: ${data.report.note.trim().slice(0, lineWidth)}`);
  }

  if (discrepancies.length > 0) {
    lines.push(rule);
    lines.push('FARKLILIKLAR');
    for (const line of discrepancies) {
      const product = data.products.find((p) => p.id === line.productId);
      const label = productLabel(product, line.productId);
      lines.push(plainPadLine(label, `${line.systemStock}>${line.scannedQty}`, lineWidth));
      const diffStr = line.diff > 0 ? `+${line.diff}` : String(line.diff);
      lines.push(plainPadLine('  Fark', diffStr, lineWidth));
    }
  } else {
    lines.push(rule);
    lines.push('Fark yok — stok uyumlu');
  }

  lines.push(...stockCountSignatureBlockPlain(data.report, lineWidth));
  return lines.join('\n');
}

export function buildStockCountReceiptHtml(data: StockCountReceiptReportData): string {
  const discrepancies = stockCountReportDiscrepancies(data.report);
  const rows = discrepancies.map((line) => {
    const product = data.products.find((p) => p.id === line.productId);
    const name = product?.name ?? `Ürün #${line.productId}`;
    const diffClass = line.diff > 0 ? 'is-up' : 'is-down';
    return `<tr>
      <td>${name}</td>
      <td style="text-align:center">${line.systemStock}</td>
      <td style="text-align:center">${line.scannedQty}</td>
      <td class="${diffClass}" style="text-align:right">${line.diff > 0 ? `+${line.diff}` : line.diff}</td>
    </tr>`;
  }).join('');

  const endedIso = data.report.endedAt ?? data.report.createdAt;
  const counter = data.report.countedByDisplayName?.trim() || 'Belirtilmedi';
  const breaksHtml = (data.report.breaks ?? []).map((entry, index) => `
    <li>
      <strong>${index + 1}. Ara verme:</strong> ${formatStockCountReportDateTime(entry.pausedAt)}
      ${entry.resumedAt
    ? ` → <strong>Devam:</strong> ${formatStockCountReportDateTime(entry.resumedAt)}`
    : ' → <em>Devam bekleniyor</em>'}
    </li>`).join('');
  const responsible = data.report.responsiblePersonName?.trim() || '';

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <title>Stok sayım raporu</title>
  <style>
    body { font-family: system-ui, sans-serif; font-size: 13px; margin: 16px; color: #111; }
    h1 { font-size: 16px; margin: 0 0 8px; }
    .meta { color: #444; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }
    th { font-size: 11px; text-transform: uppercase; color: #666; }
    .is-up { color: #15803d; font-weight: 700; }
    .is-down { color: #b91c1c; font-weight: 700; }
    .footer { margin-top: 16px; font-size: 11px; color: #666; }
    .signatures { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
    .sign-box { border-top: 1px solid #333; padding-top: 8px; min-height: 72px; }
    .sign-box strong { display: block; margin-bottom: 6px; }
    .sign-line { margin: 8px 0; border-bottom: 1px solid #999; min-height: 22px; }
  </style>
</head>
<body>
  <h1>${data.businessName} — Stok sayım raporu</h1>
  <div class="meta">
    Rapor ${data.report.id}<br />
    <strong>Sayım yapan:</strong> ${counter}<br />
    <strong>Başlangıç:</strong> ${formatStockCountReportDateTime(data.report.startedAt)}<br />
    <strong>Bitiş:</strong> ${formatStockCountReportDateTime(endedIso)}<br />
    <strong>Yazdırma:</strong> ${formatReceiptDateTime(data.printedAt)}<br />
    ${data.report.lines.length} kalem · ${discrepancies.length} farklı ürün
    ${breaksHtml ? `<ul>${breaksHtml}</ul>` : ''}
  </div>
  ${discrepancies.length > 0 ? `
  <table>
    <thead><tr><th>Ürün</th><th>Sistem</th><th>Sayım</th><th>Fark</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>` : '<p>Tüm satırlar sistem stoğu ile uyumlu.</p>'}
  ${data.report.note.trim() ? `<p><strong>Not:</strong> ${data.report.note.trim()}</p>` : ''}
  <div class="signatures">
    <div class="sign-box">
      <strong>Sayım yapan</strong>
      <div>${counter}</div>
      <div class="sign-line">Ad soyad</div>
      <div class="sign-line">İmza</div>
    </div>
    <div class="sign-box">
      <strong>Sorumlu</strong>
      <div>${responsible || '&nbsp;'}</div>
      <div class="sign-line">Ad soyad</div>
      <div class="sign-line">İmza</div>
    </div>
  </div>
  <div class="footer">Bilgi amaçlıdır.</div>
  <script>window.onload=function(){setTimeout(function(){window.print();},120);};</script>
</body>
</html>`;
}

export interface PrintStockCountReceiptResult {
  printed: boolean;
  thermal?: boolean;
  message?: string;
}

export async function printStockCountReceiptReport(
  data: StockCountReceiptReportData,
  windowsPrinterName?: string,
): Promise<PrintStockCountReceiptResult> {
  const printerName = windowsPrinterName?.trim() || STANDARD_WINDOWS_ZYWELL_PRINTER_NAME;
  const plain = buildPlainTextStockCountReceipt(data);
  const rawOk = await tryLimaRawReceiptPrint(plain, printerName);
  if (rawOk) {
    return { printed: true, thermal: true, message: 'Sayım raporu yazdırıldı (termal)' };
  }
  const rawErr = getLastLimaRawPrintError();
  if (rawErr) {
    await printHtmlReceipt(buildStockCountReceiptHtml(data));
    return {
      printed: true,
      thermal: false,
      message: `${rawErr} — tarayıcı yazdırma açıldı`,
    };
  }
  await printHtmlReceipt(buildStockCountReceiptHtml(data));
  return { printed: true, thermal: false, message: 'Tarayıcı yazdırma açıldı' };
}
